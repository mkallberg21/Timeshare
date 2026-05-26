import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import Anthropic from '@anthropic-ai/sdk';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import type { QualificationScore, ExitTrack } from '@exitforge/shared';
import type { SubmitIntakeDto } from './dto/intake.dto';

const ExtractedIntakeSchema = z.object({
  resort_name: z.string(),
  resort_state: z.string().nullable(),
  contract_year: z.number().nullable(),
  purchase_price: z.number(),
  maintenance_fee_annual: z.number(),
  outstanding_mortgage: z.number(),
  misrepresentation_claims: z.array(z.string()),
  client_financial_hardship: z.boolean(),
  years_owned: z.number().nullable(),
});

type ExtractedIntake = z.infer<typeof ExtractedIntakeSchema>;

const QUALIFICATION_PROMPT = (data: ExtractedIntake) => `
You are a legal intake specialist for ExitForge, a timeshare exit firm.
Analyze this timeshare case data and provide a preliminary qualification assessment.

Case data:
- Resort: ${data.resort_name} (${data.resort_state ?? 'state unknown'})
- Contract year: ${data.contract_year ?? 'unknown'}
- Purchase price: $${data.purchase_price.toLocaleString()}
- Annual maintenance fee: $${data.maintenance_fee_annual.toLocaleString()}
- Outstanding mortgage: $${data.outstanding_mortgage.toLocaleString()}
- Misrepresentation claims: ${data.misrepresentation_claims.length > 0 ? data.misrepresentation_claims.join('; ') : 'none reported'}
- Financial hardship: ${data.client_financial_hardship ? 'yes' : 'no'}

Provide a brief assessment (2-3 sentences) explaining why this case is or is not strong.
Focus on: misrepresentation strength, financial leverage, exit track likelihood.
Return ONLY the assessment text, nothing else.
`;

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  /**
   * Runs AI-assisted extraction + ML qualification scoring on the intake submission.
   * Returns qualification score and recommended exit track.
   */
  async qualifyCase(dto: SubmitIntakeDto): Promise<{
    extracted: ExtractedIntake;
    qualification: QualificationScore;
    aiAssessment: string;
  }> {
    // Build structured data — intake form is already structured, 
    // but AI can enrich and normalize
    const extracted: ExtractedIntake = {
      resort_name: dto.resortName,
      resort_state: dto.resortState ?? null,
      contract_year: dto.contractYear,
      purchase_price: dto.purchasePrice,
      maintenance_fee_annual: dto.maintenanceFeeAnnual,
      outstanding_mortgage: dto.outstandingMortgage,
      misrepresentation_claims: dto.misrepresentationClaims,
      client_financial_hardship: dto.financialHardship,
      years_owned: dto.contractYear
        ? new Date().getFullYear() - dto.contractYear
        : null,
    };

    // Get AI narrative assessment
    const aiAssessment = await this.getAiAssessment(extracted);

    // Get ML qualification score
    const qualification = await this.callMlService(extracted);

    return { extracted, qualification, aiAssessment };
  }

  private async getAiAssessment(data: ExtractedIntake): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: QUALIFICATION_PROMPT(data) }],
      });

      const block = response.content[0];
      if (block.type !== 'text') {
        return 'Unable to generate assessment at this time.';
      }
      return block.text;
    } catch (error) {
      this.logger.error('Claude assessment failed', { error });
      return 'Assessment unavailable — case will be reviewed by team.';
    }
  }

  private async callMlService(data: ExtractedIntake): Promise<QualificationScore> {
    const mlUrl = this.config.getOrThrow<string>('ML_SERVICE_URL');

    try {
      const { data: result } = await firstValueFrom(
        this.http.post<{
          score: number;
          eligible: boolean;
          estimated_recovery_low: number;
          estimated_recovery_high: number;
          recommended_track: string;
          explanation: string;
        }>(`${mlUrl}/predict/qualification`, {
          resort_name: data.resort_name,
          resort_state: data.resort_state,
          contract_year: data.contract_year,
          purchase_price: data.purchase_price,
          maintenance_fee_annual: data.maintenance_fee_annual,
          outstanding_mortgage: data.outstanding_mortgage,
          misrepresentation_count: data.misrepresentation_claims.length,
          financial_hardship: data.client_financial_hardship,
        }),
      );

      return {
        score: result.score,
        eligible: result.eligible,
        estimatedRecoveryLow: result.estimated_recovery_low,
        estimatedRecoveryHigh: result.estimated_recovery_high,
        recommendedTrack: result.recommended_track as ExitTrack,
        reason: result.explanation,
      };
    } catch (error) {
      this.logger.error('ML service call failed — using fallback scoring', { error });
      return this.rulesBasedFallback(data);
    }
  }

  /**
   * Fallback qualification scoring used when ML service is unavailable.
   * Same logic as ml-service bootstrap scorer for consistency.
   */
  private rulesBasedFallback(data: ExtractedIntake): QualificationScore {
    let score = 0.5;

    score += Math.min(data.misrepresentation_claims.length * 0.08, 0.24);
    if (data.outstanding_mortgage > 0) score += 0.08;
    if (data.contract_year && data.contract_year < 2015) score += 0.05;
    if (data.maintenance_fee_annual > 1500) score += 0.05;
    if (data.client_financial_hardship) score += 0.04;

    score = Math.min(score, 0.99);

    const recoveryBasis = data.outstanding_mortgage + data.maintenance_fee_annual * 5;
    let recommendedTrack: ExitTrack = 'DEED_BACK';
    if (data.misrepresentation_claims.length >= 2) recommendedTrack = 'LEGAL_DEMAND';
    else if (data.outstanding_mortgage === 0) recommendedTrack = 'DEED_BACK';
    else if (score > 0.8) recommendedTrack = 'REGULATORY_PRESSURE';

    return {
      score,
      eligible: score >= 0.65,
      estimatedRecoveryLow: recoveryBasis * 0.6,
      estimatedRecoveryHigh: recoveryBasis * 1.1,
      recommendedTrack,
      reason: 'Rules-based scoring (ML service unavailable)',
    };
  }
}
