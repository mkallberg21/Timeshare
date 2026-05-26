import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttorneyRoutingService } from './attorney-routing.service';

class AddToReviewQueueDto {
  @ApiProperty()
  @IsString()
  caseId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  roundNumber!: number;

  @ApiProperty()
  @IsString()
  track!: string;

  @ApiProperty()
  @IsString()
  letterDraft!: string;

  @ApiProperty({ description: 'SLA in hours for attorney review' })
  @IsNumber()
  @Min(1)
  slaHours!: number;
}

class ApproveReviewDto {
  @ApiProperty()
  @IsString()
  attorneyId!: string;
}

@ApiTags('Legal')
@ApiBearerAuth()
@Controller('api/v1/legal')
export class AttorneyController {
  private readonly logger = new Logger(AttorneyController.name);

  constructor(private readonly routing: AttorneyRoutingService) {}

  @Post('attorney/review-queue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add letter draft to attorney review queue' })
  async addToQueue(@Body() dto: AddToReviewQueueDto) {
    const result = await this.routing.addToReviewQueue({
      caseId: dto.caseId,
      roundNumber: dto.roundNumber,
      track: dto.track,
      letterDraft: dto.letterDraft,
      slaHours: dto.slaHours,
    });

    return { success: true, data: result };
  }

  @Get('attorney/review-queue')
  @ApiOperation({ summary: 'Get pending attorney review queue' })
  async getQueue() {
    const items = await this.routing.getReviewQueue();
    return { success: true, data: { items, total: items.length } };
  }

  @Patch('attorney/review-queue/:queueId/approve')
  @ApiOperation({ summary: 'Attorney approves a letter draft' })
  async approve(
    @Param('queueId') queueId: string,
    @Body() dto: ApproveReviewDto,
  ) {
    await this.routing.approveReview(queueId, dto.attorneyId);
    return { success: true, data: { queueId, approved: true } };
  }

  @Get('health')
  health() {
    return { status: 'healthy', service: 'legal-service' };
  }
}
