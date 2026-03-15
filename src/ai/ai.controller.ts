import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AiService }   from './ai.service';
import { JudgeDto }    from './dto/judge.dto';
import { RespondDto }  from './dto/respond.dto';
import { ReportDto }   from './dto/report.dto';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * POST /ai/judge
   * Scores a single debate argument using the strict academic judge.
   * Temperature: 0. Returns structured ScoreResult — never raw Claude output.
   */
  @Post('judge')
  async judge(@Body() dto: JudgeDto) {
    try {
      return await this.aiService.judgeArgument(dto);
    } catch (err) {
      this.logger.error(`[/ai/judge] Unhandled: ${err.message}`);
      throw new HttpException(
        { error: 'AI judge unavailable', fallback: true },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * POST /ai/respond
   * Generates a bot counter-argument in natural language.
   * Handles three sub-paths (arena AI, bot responder, generic) via dto shape.
   * Returns { response: string } — never raw Claude output.
   */
  @Post('respond')
  async respond(@Body() dto: RespondDto) {
    try {
      return await this.aiService.generateResponse(dto);
    } catch (err) {
      this.logger.error(`[/ai/respond] Unhandled: ${err.message}`);
      throw new HttpException(
        { error: 'AI responder unavailable', fallback: true },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * POST /ai/report
   * Generates a structured end-of-debate analysis report.
   * Temperature: 0.3. Uses extractJSON for robust parsing.
   * Returns the parsed report object, or 503 if Claude fails.
   */
  @Post('report')
  async report(@Body() dto: ReportDto) {
    try {
      const result = await this.aiService.generateReport(dto);

      if (!result) {
        // Let the frontend use its local fallback (handleEndDebate already handles null)
        throw new HttpException(
          { error: 'AI report generation failed', fallback: true },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`[/ai/report] Unhandled: ${err.message}`);
      throw new HttpException(
        { error: 'AI report unavailable', fallback: true },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
