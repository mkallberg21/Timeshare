import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import Stripe from 'stripe';
import { firstValueFrom } from 'rxjs';
import { KafkaService } from '../kafka/kafka.service';
import type { FeeCalculatedPayload } from '@exitforge/shared';
import { randomUUID } from 'crypto';

const FEE_RATE = 0.07 as const;
const MAINTENANCE_FEE_YEARS = 5 as const;

export interface CreateEscrowParams {
  caseId: string;
  clientEmail: string;
  feeAmount: number;
  description: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe;
  private readonly escrowBaseUrl: string;
  private readonly escrowApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly kafka: KafkaService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
    });
    this.escrowBaseUrl = this.config.get<string>(
      'ESCROW_API_URL',
      'https://api.escrow.com/2017-09-01',
    );
    this.escrowApiKey = this.config.get<string>('ESCROW_API_KEY', '');
  }

  /**
   * Calculates the 7% contingency fee based on:
   * - Outstanding mortgage eliminated
   * - 5 years of maintenance fees avoided
   */
  calculateFee(params: {
    outstandingMortgage: number;
    maintenanceFeeAnnual: number;
  }): {
    basisAmount: number;
    feeRate: number;
    feeAmount: number;
    breakdown: { mortgageEliminated: number; maintenanceFeesAvoided: number };
  } {
    const mortgageBasis = params.outstandingMortgage;
    const maintenanceBasis = params.maintenanceFeeAnnual * MAINTENANCE_FEE_YEARS;
    const totalBasis = mortgageBasis + maintenanceBasis;
    const feeAmount = totalBasis * FEE_RATE;

    return {
      basisAmount: totalBasis,
      feeRate: FEE_RATE,
      feeAmount,
      breakdown: {
        mortgageEliminated: mortgageBasis,
        maintenanceFeesAvoided: maintenanceBasis,
      },
    };
  }

  /**
   * Creates an Escrow.com transaction to hold the contingency fee
   * until exit is confirmed. Fee is released only on successful close.
   */
  async createEscrowTransaction(params: CreateEscrowParams): Promise<{
    escrowId: string;
    status: string;
    checkoutUrl: string;
  }> {
    if (!this.escrowApiKey) {
      this.logger.warn('Escrow API key not configured — returning mock escrow');
      return {
        escrowId: `mock-escrow-${randomUUID()}`,
        status: 'PENDING',
        checkoutUrl: 'https://escrow.com/checkout/mock',
      };
    }

    const { data } = await firstValueFrom(
      this.http.post<{ id: string; status: string; checkout_url: string }>(
        `${this.escrowBaseUrl}/transaction`,
        {
          currency: 'usd',
          description: params.description,
          parties: [
            {
              role: 'buyer',
              customer: params.clientEmail,
            },
            {
              role: 'seller',
              customer: this.config.get<string>('ESCROW_SELLER_EMAIL', 'payments@exitforge.com'),
            },
          ],
          items: [
            {
              title: 'ExitForge Contingency Fee',
              description: `Case ${params.caseId} — 7% exit success fee`,
              type: 'general_merchandise',
              quantity: 1,
              unit_price: params.feeAmount,
              inspection_period: 3,
            },
          ],
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`exitforge:${this.escrowApiKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    this.logger.log('Escrow transaction created', {
      escrowId: data.id,
      caseId: params.caseId,
      feeAmount: params.feeAmount,
    });

    return {
      escrowId: data.id,
      status: data.status,
      checkoutUrl: data.checkout_url,
    };
  }

  /**
   * Releases escrowed funds to ExitForge on confirmed case close.
   * This is irreversible — only call after exit is fully confirmed.
   */
  async releaseEscrow(escrowId: string, caseId: string): Promise<void> {
    if (!this.escrowApiKey) {
      this.logger.warn('Escrow API key not configured — skipping release', { escrowId });
      return;
    }

    await firstValueFrom(
      this.http.patch(
        `${this.escrowBaseUrl}/transaction/${escrowId}`,
        { action: 'buyer_agrees_to_release' },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`exitforge:${this.escrowApiKey}`).toString('base64')}`,
          },
        },
      ),
    );

    this.logger.log('Escrow released', { escrowId, caseId });
  }

  /**
   * Handles Stripe webhook events for payment lifecycle tracking.
   * Only processes payment_intent events relevant to escrow flows.
   */
  async processStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ processed: boolean; eventType: string }> {
    const webhookSecret = this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${String(err)}`);
    }

    this.logger.log('Stripe webhook received', { type: event.type });

    // Handle relevant event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        this.logger.log('Payment intent succeeded', { id: event.data.object.id });
        break;
      case 'payment_intent.payment_failed':
        this.logger.warn('Payment intent failed', { id: event.data.object.id });
        break;
      default:
        // Unhandled — not an error, just not relevant
        break;
    }

    return { processed: true, eventType: event.type };
  }
}
