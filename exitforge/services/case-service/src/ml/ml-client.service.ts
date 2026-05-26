import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Case, Timeshare } from '@prisma/client';
import { z } from 'zod';

const TimelineResponseSchema = z.object({
  p50_days: z.number().int().positive(),
  p90_days: z.number().int().positive(),
  current_stage_days_remaining: z.number().int().nonnegative(),
});

@Injectable()
export class MLClientService {
  private readonly logger = new Logger(MLClientService.name);
  private readonly mlServiceUrl: string;

  constructor(private readonly config: ConfigService) {
    this.mlServiceUrl = config.getOrThrow<string>('ML_SERVICE_URL');
  }

  async predictTimeline(
    caseData: Case & { timeshare: (Timeshare & { resort: { resistanceScore: number } }) | null },
  ) {
    const body = {
      case_id: caseData.id,
      exit_track: caseData.exitTrack ?? 'DEED_BACK',
      resort_resistance_score: caseData.timeshare?.resort.resistanceScore ?? 0.5,
      negotiation_round: 1,
    };

    try {
      const response = await fetch(`${this.mlServiceUrl}/predict/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`ML service returned ${response.status}`);
      }

      const raw: unknown = await response.json();
      const parsed = TimelineResponseSchema.safeParse(raw);

      if (!parsed.success) {
        throw new Error(`ML service response validation failed: ${parsed.error.message}`);
      }

      return {
        p50Days: parsed.data.p50_days,
        p90Days: parsed.data.p90_days,
        currentStageDaysRemaining: parsed.data.current_stage_days_remaining,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`ML timeline prediction failed: ${message}`);
      throw new ServiceUnavailableException('Timeline prediction temporarily unavailable');
    }
  }
}
