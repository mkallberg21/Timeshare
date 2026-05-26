import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntakeService } from './intake.service';
import { KafkaService } from '../kafka/kafka.service';
import { SubmitIntakeDto } from './dto/intake.dto';
import type { QualificationCompletedPayload } from '@exitforge/shared';
import { randomUUID } from 'crypto';

@ApiTags('Intake')
@Controller('api/v1/intake')
export class IntakeController {
  private readonly logger = new Logger(IntakeController.name);

  constructor(
    private readonly intakeService: IntakeService,
    private readonly kafkaService: KafkaService,
  ) {}

  @Post('qualify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit intake data and receive qualification score',
    description:
      'AI + ML pipeline scores eligibility. Score ≥ 0.65 = eligible, < 0.50 = decline, 0.50–0.65 = human review.',
  })
  async qualify(@Body() dto: SubmitIntakeDto) {
    const correlationId = randomUUID();
    const { extracted, qualification, aiAssessment } =
      await this.intakeService.qualifyCase(dto);

    // Emit qualification event for downstream consumers
    if (extracted.resort_name) {
      await this.kafkaService.emit<QualificationCompletedPayload>(
        'case.qualification.completed',
        'intake',
        {
          caseId: 'pending', // case ID assigned after client creates account
          score: qualification.score,
          eligible: qualification.eligible,
          recommendedTrack: qualification.recommendedTrack,
        },
        correlationId,
      );
    }

    this.logger.log('Intake qualified', {
      score: qualification.score,
      eligible: qualification.eligible,
      correlationId,
    });

    return {
      success: true,
      data: {
        qualification,
        aiAssessment,
        nextStep: qualification.eligible
          ? 'create_account'
          : qualification.score >= 0.5
            ? 'human_review'
            : 'ineligible',
        resortName: extracted.resort_name,
        yearsOwned: extracted.years_owned,
      },
    };
  }

  @Post('chatbot/message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a message to the AI intake chatbot',
    description: 'Conversational intake — AI extracts case data through natural dialogue.',
  })
  async chatMessage(
    @Body() body: { sessionId: string; message: string },
  ) {
    // Chatbot handled via AI orchestrator streaming; 
    // this endpoint proxies to orchestrator
    return {
      success: true,
      data: {
        sessionId: body.sessionId,
        status: 'Message routing not yet wired to orchestrator',
      },
    };
  }
}
