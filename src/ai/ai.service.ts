import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { JudgeDto }   from './dto/judge.dto';
import { RespondDto } from './dto/respond.dto';
import { ReportDto }  from './dto/report.dto';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL   = 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';
const TIMEOUT_MS        = 10_000;

const SCORE_FIELDS = ['logic', 'evidence', 'relevance', 'rebuttal', 'clarity'] as const;
type ScoreField = typeof SCORE_FIELDS[number];

const WEIGHTS: Record<ScoreField, number> = {
  logic:     0.28,
  relevance: 0.25,
  evidence:  0.22,
  rebuttal:  0.15,
  clarity:   0.10,
};

const VALID_STYLES = ['logical', 'emotional', 'rhetorical', 'mixed'] as const;

/* ─── Global language mandate ────────────────────────────────────────────── */
/**
 * Prepended to EVERY prompt sent to Claude.
 * Absolute, unconditional, repeatable — Claude honours multilingual mandates
 * more reliably when they appear at the very top AND again at the very bottom.
 */
const FRENCH_MANDATE = `RÈGLE ABSOLUE DE LANGUE :
Tu réponds UNIQUEMENT et EXCLUSIVEMENT en français.
Peu importe la langue dans laquelle l'utilisateur écrit (anglais, arabe, charabia…),
TOUTES tes réponses — textes, analyses, conseils, arguments — sont rédigées en français.
Ne jamais répondre en anglais. Ne jamais mélanger les langues. Français uniquement.
`;

/** Footer appended to every non-JSON prompt as a final language reinforcement. */
const FRENCH_FOOTER = `\n⚠ RAPPEL FINAL : Réponds en français uniquement. Jamais en anglais.`;

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface ScoreResult {
  logic:              number;
  evidence:           number;
  relevance:          number;
  rebuttal:           number;
  clarity:            number;
  overall_score:      number;
  confidence:         number;
  argument_style:     string;
  fallacies:          string[];
  analysis:           string;
  improvement_advice: string;
  strengths:          string[];
  weaknesses:         string[];
  fallback:           boolean;
}

/* ─── Fallback score (French strings) ───────────────────────────────────── */

const DEFAULT_SCORE: ScoreResult = {
  logic:              4,
  evidence:           3,
  relevance:          4,
  rebuttal:           3,
  clarity:            4,
  overall_score:      3.6,
  confidence:         0.3,
  argument_style:     'mixed',
  fallacies:          [],
  analysis:           'Analyse IA indisponible — score de repli utilisé.',
  improvement_advice: 'Structurez votre raisonnement et appuyez-le sur des exemples concrets.',
  strengths:          [],
  weaknesses:         [],
  fallback:           true,
};

/* ─── Service ────────────────────────────────────────────────────────────── */

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  /* ── Brace-depth JSON extractor ──────────────────────────────────────── */
  private extractJSON(text: string): string | null {
    if (!text) return null;

    let depth      = 0;
    let startIndex = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) startIndex = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          return text.slice(startIndex, i + 1);
        }
      }
    }

    return null;
  }

  /* ── English-language guard ──────────────────────────────────────────── */
  /**
   * Returns true when the response looks predominantly English.
   * Heuristic: counts high-frequency English function words that do NOT
   * exist in French. If ≥ 4 such tokens are found the text is flagged.
   * Max 1 retry per call — no loops.
   */
  private looksEnglish(text: string): boolean {
    if (!text || text.length < 20) return false;
    const lower = ` ${text.toLowerCase()} `;
    // English-only function words unlikely to appear in correct French
    const markers = [
      ' the ', ' this ', ' that ', ' these ', ' those ',
      ' are ', ' were ', ' have ', ' has ', ' been ',
      ' with ', ' from ', ' your ', ' their ', ' which ',
      ' would ', ' could ', ' should ', ' because ', ' therefore ',
    ];
    const hits = markers.filter(m => lower.includes(m)).length;
    return hits >= 4;
  }

  /* ── Judge prompt ────────────────────────────────────────────────────── */
  private buildJudgePrompt(argument: string, topic: string, opponent?: string): string {
    const opponentBlock = opponent?.trim()
      ? `\nDERNIER ARGUMENT DE L'ADVERSAIRE :\n${opponent.trim()}\n`
      : '';

    return `${FRENCH_MANDATE}
Tu es un juge académique de débat, strict et impartial. Pas un assistant. Pas un coach. Un juge.
Toutes tes évaluations — analyse, conseils, forces, faiblesses — sont rédigées en français.

SUJET DU DÉBAT : "${topic}"
${opponentBlock}
PHILOSOPHIE DE NOTATION :
- Un argument moyen obtient environ 3 sur 10.
- Les arguments faibles obtiennent entre 1 et 2,5.
- Seuls les arguments solides et bien structurés méritent 4 ou plus.
- Les notes de 8 à 10 sont extrêmement rares et réservées à une argumentation exceptionnelle.
- Ne jamais gonfler les notes par politesse. Ton rôle est l'évaluation, pas l'encouragement.

PÉNALITÉS OBLIGATOIRES — à appliquer strictement :
- Texte incohérent, absurde ou aléatoire → toutes les notes ≤ 2
- Pas de structure logique (pas de prémisse → conclusion) → note logique ≤ 3
- Pas de preuves, faits ou exemples concrets → note preuves ≤ 2
- Ignore totalement l'adversaire → note réfutation ≤ 2
- Argument générique, vague ou cliché → note globale plafonnée à 3

ÉCHELLE DE NOTATION (applicable à tous les champs) :
0–2  = très faible — absent ou incohérent
3–4  = faible — présent mais gravement défaillant
5–6  = acceptable — médiocre, fonctionnel mais peu convaincant
7–8  = solide — clair, structuré, bien étayé
9–10 = exceptionnel — rigoureux, précis, convaincant (rare)

ARGUMENT À ÉVALUER :
${argument}

Ne pas équilibrer les notes entre les deux côtés. Un côté peut clairement perdre.
Ne pas supposer que l'argument est bon. Partir du principe qu'il est médiocre jusqu'à preuve du contraire.

Retourne UNIQUEMENT du JSON. Aucun texte avant ou après. Aucune explication. Aucun commentaire.
Les champs "analysis", "improvement_advice", "fallacies", "strengths" et "weaknesses" sont en français.

{
  "logic": number,
  "evidence": number,
  "relevance": number,
  "rebuttal": number,
  "clarity": number,
  "confidence": number,
  "argument_style": "logical|emotional|rhetorical|mixed",
  "fallacies": [],
  "analysis": "justification académique brève des notes (1-2 phrases en français)",
  "improvement_advice": "un conseil d'amélioration spécifique et actionnable en français",
  "strengths": [],
  "weaknesses": []
}

RETOURNE UNIQUEMENT LE JSON. N'AJOUTE AUCUN AUTRE TEXTE.`;
  }

  /* ── Bot responder prompt (aiBotRespond path) ────────────────────────── */
  private buildBotRespondPrompt(dto: RespondDto): string {
    const styleMap: Record<string, string> = {
      beginner:      'arguments simples et accessibles',
      intermediate:  'équilibré, logique et clair',
      advanced:      'rigoureux, réfutations précises',
      expert:        'maîtrise totale, détecte les sophismes',
      philosophical: 'méthode socratique, questionne les prémisses',
      skeptical:     'remet en question, exige des preuves',
      political:     'rhétorique populiste, appel au public',
      logical:       'structure logique stricte, prémisses claires',
      emotional:     'appel aux valeurs humaines et à l\'empathie',
      aggressive:    'direct, incisif, attaque la faiblesse centrale',
      academic:      'langage formel, références théoriques',
      provocative:   'expose les contradictions cachées',
    };
    const styleDesc = styleMap[dto.style || 'logical'] ?? 'équilibré et structuré';

    return (
      `${FRENCH_MANDATE}\n` +
      `Tu es ${dto.botName || 'le débatteur'}, spécialisé dans le style "${styleDesc}".\n` +
      `SUJET : "${dto.topic || ''}"\n` +
      `HISTORIQUE :\n${dto.history || '(aucun)'}\n` +
      `DERNIER ARGUMENT DE L'ADVERSAIRE : "${dto.argument}"\n\n` +
      `Réponds avec un contre-argument en 1 à 3 phrases naturelles.\n` +
      `Style : ${styleDesc}.\n` +
      `Réponds UNIQUEMENT avec l'argument. Pas de préambule, pas de label, pas de JSON.` +
      FRENCH_FOOTER
    );
  }

  /* ── Generic responder prompt (simple path) ──────────────────────────── */
  private buildResponderPrompt(argument: string, style = 'logical', phase = 'debate'): string {
    const styleGuide: Record<string, string> = {
      logical:      'structure logique stricte — prémisses claires menant à une conclusion',
      expert:       'argumentation rigoureuse, références à des raisonnements établis',
      emotional:    'appel aux valeurs partagées, impact humain et empathie',
      rhetorical:   'figures de style, analogies et langage persuasif',
      philosophical:'questions profondes, remise en cause des hypothèses à la manière socratique',
      skeptical:    'remet en question les preuves, exige des démonstrations, conteste chaque prémisse',
      political:    'cadrage populiste, appel large à la société',
      aggressive:   'direct et incisif, expose la faiblesse principale sans détour',
      academic:     'langage formel, références à la littérature et aux théories reconnues',
      provocative:  'expose les contradictions cachées, formulations courtes et déstabilisantes',
    };

    const phaseLabel: Record<string, string> = {
      opening:  'ouverture',
      debate:   'débat',
      rebuttal: 'réfutation',
      closing:  'conclusion',
    };

    return (
      `${FRENCH_MANDATE}\n` +
      `Tu es un participant au débat (style : ${style}, phase : ${phaseLabel[phase] ?? phase}).\n\n` +
      `Ton adversaire vient de dire :\n"${argument}"\n\n` +
      `Réponds avec un contre-argument direct et ciblé en 2 à 3 phrases. Sois précis, pas générique.\n` +
      `Guide de style : ${styleGuide[style] ?? 'équilibré, clair et structuré'}\n\n` +
      `Retourne UNIQUEMENT le texte de l'argument. Pas de JSON. Pas de label. Pas de préfixe.` +
      FRENCH_FOOTER
    );
  }

  /* ── Report prompt (aiReport path) ──────────────────────────────────── */
  private buildReportPrompt(dto: ReportDto): string {
    return (
      `${FRENCH_MANDATE}\n` +
      `DIALECTIX — Rapport de débat IA. FORMAT:${dto.format || 'standard'} SUJET:"${dto.topic}" ` +
      `DURÉE:${dto.elapsedFmt} ${dto.nA}:${dto.scoreA.toFixed(2)} ${dto.nB}:${dto.scoreB.toFixed(2)} ` +
      `ArgsA:${dto.argsA} ArgsB:${dto.argsB} VAR:${dto.varCount}\n\n` +
      `Tous les textes du rapport sont en français (winner_reason, summary, strongest_a/b, weakest_a/b, rec_a/b, mvp_argument).\n` +
      `Retourne UNIQUEMENT du JSON avec cette structure exacte (aucun texte avant ou après) :\n` +
      `{"winner":"${dto.nA}|${dto.nB}|Égalité","verdict":"Victoire dominante|Victoire nette|Victoire serrée|Égalité",` +
      `"margin":"<écart>","winner_reason":"<2 phrases en français>","summary":"<3 phrases en français>",` +
      `"strongest_a":"<1 phrase en français>","strongest_b":"<1 phrase en français>",` +
      `"weakest_a":"<1 phrase en français>","weakest_b":"<1 phrase en français>",` +
      `"key_fallacies":["<sophisme en français>"],"key_strengths":["<force en français>"],` +
      `"rec_a":"<conseil en français>","rec_b":"<conseil en français>",` +
      `"quality":"Excellent|Bon|Moyen|Faible","mvp_argument":"<argument phare en français>","percentile":<0-100>}`
    );
  }

  /* ── Core Anthropic caller ───────────────────────────────────────────── */
  /**
   * @param prompt      – user-turn content
   * @param temperature – 0 for judge, 0.3 for report, 0.7–0.75 for responder
   * @param maxTokens   – token budget for this call
   * @param system      – optional top-level system prompt (for arena AI style injection)
   */
  private async callAnthropic(
    prompt: string,
    temperature: number,
    maxTokens: number,
    system?: string,
  ): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      this.logger.error('[ANTHROPIC] ANTHROPIC_API_KEY is not configured in .env');
      throw new Error('API key not configured');
    }

    const start = Date.now();
    this.logger.log(
      `[ANTHROPIC] → request | temp=${temperature} | maxTokens=${maxTokens} | system=${!!system}`,
    );

    try {
      const body: Record<string, unknown> = {
        model:      ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'user', content: [{ type: 'text', text: prompt }] },
        ],
      };

      // Inject system prompt only when provided (arena AI style)
      if (system) body.system = system;

      const res = await axios.post(ANTHROPIC_URL, body, {
        headers: {
          'content-type':      'application/json',
          'x-api-key':          apiKey,
          'anthropic-version':  ANTHROPIC_VERSION,
        },
        timeout: TIMEOUT_MS,
      });

      const elapsed = Date.now() - start;
      this.logger.log(`[ANTHROPIC] ← response in ${elapsed}ms`);

      return (res.data?.content ?? [])
        .map((b: { text?: string }) => b.text ?? '')
        .join('');

    } catch (err) {
      const elapsed = Date.now() - start;

      if (axios.isAxiosError(err)) {
        const axErr = err as AxiosError;
        if (axErr.code === 'ECONNABORTED') {
          this.logger.error(`[ANTHROPIC] Timed out after ${elapsed}ms`);
          throw new Error('Request timed out');
        }
        const status = axErr.response?.status;
        const body   = JSON.stringify(axErr.response?.data ?? {});
        this.logger.error(`[ANTHROPIC] HTTP ${status} after ${elapsed}ms — ${body.slice(0, 200)}`);
        throw new Error(`Anthropic API error ${status}`);
      }

      this.logger.error(`[ANTHROPIC] Unexpected error after ${elapsed}ms — ${err}`);
      throw err;
    }
  }

  /* ── Score parser ────────────────────────────────────────────────────── */
  private parseScore(raw: string): ScoreResult {
    this.logger.log(`[JUDGE] RAW (first 300): ${raw.slice(0, 300)}`);

    const jsonStr = this.extractJSON(raw);

    if (!jsonStr) {
      this.logger.warn('[JUDGE] No JSON found in response — fallback triggered');
      return DEFAULT_SCORE;
    }

    try {
      const p = JSON.parse(jsonStr);

      const scores: Partial<Record<ScoreField, number>> = {};
      for (const field of SCORE_FIELDS) {
        let n = Number(p[field]);
        if (isNaN(n)) {
          this.logger.warn(`[JUDGE] Field "${field}" missing → default ${DEFAULT_SCORE[field]}`);
          n = DEFAULT_SCORE[field] as number;
        }
        scores[field] = Math.max(0, Math.min(10, n));
      }

      let overall = 0;
      for (const f of SCORE_FIELDS) overall += (scores[f] as number) * WEIGHTS[f];
      overall = Math.round(overall * 100) / 100;

      let conf = Number(p.confidence);
      if (isNaN(conf)) conf = 0.4;
      conf = Math.max(0, Math.min(1, conf));

      const argStyle =
        typeof p.argument_style === 'string' &&
        VALID_STYLES.includes(p.argument_style as typeof VALID_STYLES[number])
          ? p.argument_style
          : 'mixed';

      const safeArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

      const result: ScoreResult = {
        logic:              scores.logic!,
        evidence:           scores.evidence!,
        relevance:          scores.relevance!,
        rebuttal:           scores.rebuttal!,
        clarity:            scores.clarity!,
        overall_score:      overall,
        confidence:         conf,
        argument_style:     argStyle,
        fallacies:          safeArr(p.fallacies),
        analysis:           typeof p.analysis           === 'string' ? p.analysis           : '',
        improvement_advice: typeof p.improvement_advice === 'string' ? p.improvement_advice : '',
        strengths:          safeArr(p.strengths),
        weaknesses:         safeArr(p.weaknesses),
        fallback:           false,
      };

      this.logger.log(`[JUDGE] overall=${result.overall_score} | style=${result.argument_style}`);
      return result;

    } catch (err) {
      this.logger.warn(`[JUDGE] JSON.parse failed: ${err.message} — fallback triggered`);
      return DEFAULT_SCORE;
    }
  }

  /* ── Public: judge an argument ───────────────────────────────────────── */
  async judgeArgument(dto: JudgeDto): Promise<ScoreResult> {
    this.logger.log(
      `[JUDGE] Request — topic: "${(dto.topic || '').slice(0, 80)}" | ` +
      `arg: ${dto.argument.length} chars | opponent: ${dto.opponent ? 'yes' : 'none'}`,
    );

    try {
      const prompt = this.buildJudgePrompt(dto.argument, dto.topic, dto.opponent);
      const raw    = await this.callAnthropic(prompt, 0, 800);
      const result = this.parseScore(raw);

      if (result.fallback) this.logger.warn('[JUDGE] Fallback returned to client');
      return result;

    } catch (err) {
      this.logger.error(`[JUDGE] Fatal — fallback. Reason: ${err.message}`);
      return DEFAULT_SCORE;
    }
  }

  /* ── Public: generate bot / arena response ───────────────────────────── */
  async generateResponse(dto: RespondDto): Promise<{ response: string }> {
    this.logger.log(
      `[RESPOND] style=${dto.style ?? 'logical'} | phase=${dto.phase ?? 'debate'} | ` +
      `system=${!!dto.system} | topic=${!!dto.topic}`,
    );

    try {
      let raw: string;

      if (dto.system) {
        // ── Arena AI path (from generateAIArgument / arenaUtils.js) ──────
        // system = style instructions (already includes French mandate from arenaUtils).
        // Prepend French mandate to the system prompt as a safety net.
        const systemWithFrench = `${FRENCH_MANDATE}\n${dto.system}`;
        raw = await this.callAnthropic(dto.argument, 0.75, 200, systemWithFrench);

      } else if (dto.topic || dto.history) {
        // ── Bot responder path (from aiBotRespond in App.jsx) ─────────────
        const prompt = this.buildBotRespondPrompt(dto);
        raw = await this.callAnthropic(prompt, 0.7, 350);

      } else {
        // ── Generic path (simple style/phase prompt) ──────────────────────
        const prompt = this.buildResponderPrompt(dto.argument, dto.style, dto.phase);
        raw = await this.callAnthropic(prompt, 0.7, 350);
      }

      // ── Language guard: single retry if response looks English ───────────
      // Max 1 retry — no loop. Applies to all responder paths (not the judge,
      // which returns JSON and is language-neutral at the transport level).
      if (this.looksEnglish(raw)) {
        this.logger.warn('[RESPOND] Response detected as English — retrying with stronger French constraint');

        const retryPrompt =
          `IMPORTANT : Ta réponse précédente était en anglais. C'est INTERDIT.\n` +
          `RÉPONDS UNIQUEMENT EN FRANÇAIS. Pas un seul mot en anglais.\n\n` +
          (dto.system
            ? dto.argument
            : dto.topic || dto.history
              ? this.buildBotRespondPrompt(dto)
              : this.buildResponderPrompt(dto.argument, dto.style, dto.phase));

        const retrySystem = dto.system
          ? `${FRENCH_MANDATE}\n${dto.system}\nIMPORTANT : Réponds UNIQUEMENT en français.`
          : undefined;

        raw = await this.callAnthropic(retryPrompt, 0.7, 350, retrySystem);
        this.logger.log('[RESPOND] Retry completed');
      }

      const response = raw.trim() || 'Je maintiens ma position.';
      this.logger.log(`[RESPOND] Generated ${response.length} chars`);
      return { response };

    } catch (err) {
      this.logger.error(`[RESPOND] Fatal — fallback. Reason: ${err.message}`);
      return { response: 'Je maintiens ma position.' };
    }
  }

  /* ── Public: generate end-of-debate report ───────────────────────────── */
  async generateReport(dto: ReportDto): Promise<Record<string, unknown> | null> {
    this.logger.log(
      `[REPORT] ${dto.nA}(${dto.scoreA}) vs ${dto.nB}(${dto.scoreB}) | ` +
      `topic: "${dto.topic.slice(0, 60)}"`,
    );

    try {
      const prompt  = this.buildReportPrompt(dto);
      const raw     = await this.callAnthropic(prompt, 0.3, 900);

      this.logger.log(`[REPORT] RAW (first 200): ${raw.slice(0, 200)}`);

      const jsonStr = this.extractJSON(raw);
      if (!jsonStr) {
        this.logger.warn('[REPORT] No JSON found in Claude response');
        return null;
      }

      const parsed = JSON.parse(jsonStr);
      this.logger.log(`[REPORT] winner=${parsed.winner} | verdict=${parsed.verdict}`);
      return parsed;

    } catch (err) {
      this.logger.error(`[REPORT] Fatal: ${err.message}`);
      return null;
    }
  }
}
