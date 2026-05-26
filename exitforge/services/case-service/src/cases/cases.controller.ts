import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClerkAuthGuard, type AuthenticatedRequest } from '../auth/clerk-auth.guard';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ApiResponse } from '../common/api-response';

@ApiTags('Cases')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard)
@Controller('api/v1/cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new case after client e-signs engagement agreement' })
  async createCase(@Request() req: AuthenticatedRequest, @Body() dto: CreateCaseDto) {
    const result = await this.casesService.createCase(req.user.id, dto);
    return ApiResponse.success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full case details including current state and ML predictions' })
  async getCase(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.casesService.getCaseForClient(id, req.user.id);
    return ApiResponse.success(result);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get ML-predicted timeline (P50 and P90 days to close)' })
  async getTimeline(@Param('id') id: string) {
    const result = await this.casesService.getMLTimeline(id);
    return ApiResponse.success(result);
  }

  @Get(':id/fee-estimate')
  @ApiOperation({ summary: 'Get live contingency fee estimate based on projected outcome' })
  async getFeeEstimate(@Param('id') id: string) {
    const result = await this.casesService.calculateFeeEstimate(id);
    return ApiResponse.success(result);
  }

  @Get(':id/negotiations')
  @ApiOperation({ summary: 'Get all negotiation rounds with resort' })
  async getNegotiations(@Param('id') id: string) {
    const result = await this.casesService.getNegotiations(id);
    return ApiResponse.success(result);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send message — AI responds in < 2 min, human escalates if needed' })
  async sendMessage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const result = await this.casesService.sendMessage(id, req.user.id, dto.content);
    return ApiResponse.success(result);
  }

  @Post(':id/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a pre-signed S3 upload URL (1-hour expiry)' })
  async getUploadUrl(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { filename: string },
  ) {
    const result = await this.casesService.getPresignedUploadUrl(id, req.user.id, body.filename);
    return ApiResponse.success(result);
  }
}
