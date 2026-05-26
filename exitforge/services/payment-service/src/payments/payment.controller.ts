import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsEmail, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { PaymentService } from './payment.service';

class CreateEscrowDto {
  @ApiProperty()
  @IsString()
  caseId!: string;

  @ApiProperty()
  @IsEmail()
  clientEmail!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  outstandingMortgage!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  maintenanceFeeAnnual!: number;
}

class FeeEstimateDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  outstandingMortgage!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  maintenanceFeeAnnual!: number;
}

class ReleaseEscrowDto {
  @ApiProperty()
  @IsString()
  escrowId!: string;

  @ApiProperty()
  @IsString()
  caseId!: string;
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('api/v1/payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('fee-estimate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate contingency fee estimate (7% of recovery basis)' })
  feeEstimate(@Body() dto: FeeEstimateDto) {
    const result = this.paymentService.calculateFee({
      outstandingMortgage: dto.outstandingMortgage,
      maintenanceFeeAnnual: dto.maintenanceFeeAnnual,
    });
    return { success: true, data: result };
  }

  @Post('escrow/create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Escrow.com transaction to hold contingency fee' })
  async createEscrow(@Body() dto: CreateEscrowDto) {
    const { feeAmount } = this.paymentService.calculateFee({
      outstandingMortgage: dto.outstandingMortgage,
      maintenanceFeeAnnual: dto.maintenanceFeeAnnual,
    });

    const result = await this.paymentService.createEscrowTransaction({
      caseId: dto.caseId,
      clientEmail: dto.clientEmail,
      feeAmount,
      description: `ExitForge — Case ${dto.caseId} contingency fee (7%)`,
    });

    return { success: true, data: result };
  }

  @Post('escrow/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release escrowed fee on confirmed exit — irreversible' })
  async releaseEscrow(@Body() dto: ReleaseEscrowDto) {
    await this.paymentService.releaseEscrow(dto.escrowId, dto.caseId);
    return { success: true, data: { released: true, escrowId: dto.escrowId } };
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver — validates signature before processing' })
  async stripeWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req.rawBody as Buffer | undefined) ?? Buffer.from('');
    const result = await this.paymentService.processStripeWebhook(rawBody, signature);
    return result;
  }

  @Get('health')
  health() {
    return { status: 'healthy', service: 'payment-service' };
  }
}
