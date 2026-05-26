import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LetterGeneratorService } from './letter-generator.service';
import { KafkaService } from '../kafka/kafka.service';
import type { ExitTrack, NegotiationLetterGeneratedPayload, NegotiationResponseReceivedPayload, ResponseType } from '@exitforge/shared';
import { randomUUID } from 'crypto';

class GenerateLetterDto {
  @ApiProperty()
  @IsString()
  caseId!: string;

  @ApiProperty({ enum: ['DEED_BACK', 'LEGAL_DEMAND', 'REGULATORY_PRESSURE', 'LITIGATION'] })
  @IsEnum(['DEED_BACK', 'LEGAL_DEMAND', 'REGULATORY_PRESSURE', 'LITIGATION'])
  track!: ExitTrack;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  roundNumber!: number;

  @ApiProperty()
  @IsString()
  resortName!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resortState?: string;

  @ApiProperty()
  @IsNumber()
  contractYear!: number;

  @ApiProperty()
  @IsNumber()
  purchasePrice!: number;

  @ApiProperty()
  @IsNumber()
  maintenanceFeeAnnual!: number;

  @ApiProperty()
  @IsNumber()
  outstandingMortgage!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  misrepresentationClaims!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  contractFlags!: string[];
}

class RecordResponseDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED', 'COUNTER', 'LEGAL_THREAT', 'NO_RESPONSE'] })
  @IsEnum(['ACCEPTED', 'REJECTED', 'COUNTER', 'LEGAL_THREAT', 'NO_RESPONSE'])
  responseType!: ResponseType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

@ApiTags('Negotiations')
@ApiBearerAuth()
@Controller('api/v1/negotiations')
export class NegotiationController {
  private readonly logger = new Logger(NegotiationController.name);

  constructor(
    private readonly letterGenerator: LetterGeneratorService,
    private readonly kafka: KafkaService,
  ) {}

  @Post('letters/generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate AI demand letter and queue for attorney review' })
  async generateLetter(@Body() dto: GenerateLetterDto) {
    const { letterText, s3Key, presignedUrl } = await this.letterGenerator.generateLetter({
      resortName: dto.resortName,
      resortState: dto.resortState ?? null,
      contractYear: dto.contractYear,
      purchasePrice: dto.purchasePrice,
      maintenanceFeeAnnual: dto.maintenanceFeeAnnual,
      outstandingMortgage: dto.outstandingMortgage,
      misrepresentationClaims: dto.misrepresentationClaims,
      contractFlags: dto.contractFlags,
      roundNumber: dto.roundNumber,
      track: dto.track,
    });

    const correlationId = randomUUID();

    await this.kafka.emit<NegotiationLetterGeneratedPayload>(
      'case.negotiation.letter.generated',
      dto.caseId,
      {
        caseId: dto.caseId,
        roundNumber: dto.roundNumber,
        track: dto.track,
        letterS3Key: s3Key,
      },
      correlationId,
    );

    this.logger.log('Letter generated', { caseId: dto.caseId, track: dto.track, s3Key });

    return {
      success: true,
      data: {
        caseId: dto.caseId,
        s3Key,
        presignedUrl,
        roundNumber: dto.roundNumber,
        track: dto.track,
        letterPreview: letterText.slice(0, 500) + (letterText.length > 500 ? '...' : ''),
        status: 'PENDING_ATTORNEY_REVIEW',
      },
    };
  }

  @Patch('cases/:caseId/rounds/:roundNumber/response')
  @ApiOperation({ summary: 'Record resort response to a negotiation letter' })
  async recordResponse(
    @Param('caseId') caseId: string,
    @Param('roundNumber') roundNumber: string,
    @Body() dto: RecordResponseDto,
  ) {
    const correlationId = randomUUID();

    await this.kafka.emit<NegotiationResponseReceivedPayload>(
      'case.negotiation.response.received',
      caseId,
      {
        caseId,
        negotiationId: randomUUID(),
        responseType: dto.responseType,
        receivedAt: new Date().toISOString(),
      },
      correlationId,
    );

    return {
      success: true,
      data: { caseId, roundNumber: parseInt(roundNumber, 10), responseType: dto.responseType },
    };
  }

  @Get('/health')
  health() {
    return { status: 'healthy', service: 'negotiation-service' };
  }
}
