import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Anthropic from '@anthropic-ai/sdk';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import type { ExitTrack } from '@exitforge/shared';

const DEED_BACK_PROMPT = (context: LetterContext) => `
You are a legal professional writing a formal timeshare deed-back request.
Write a professional, firm demand letter requesting a deed-back (voluntary cancellation).

Resort: ${context.resortName}
State: ${context.resortState ?? 'Not specified'}
Contract Year: ${context.contractYear}
Purchase Price: $${context.purchasePrice.toLocaleString()}
Annual Maintenance Fee: $${context.maintenanceFeeAnnual.toLocaleString()}
Outstanding Mortgage: $${context.outstandingMortgage.toLocaleString()}
Client Misrepresentation Claims: ${context.misrepresentationClaims.join('; ') || 'None documented'}
Round: ${context.roundNumber}

Include:
1. Formal salutation to the resort exit/deed-back department
2. Clear request for deed-back acceptance
3. Reference to any documented misrepresentations
4. 14-day response deadline
5. Statement that non-response triggers regulatory complaint escalation
6. Professional closing

Format as a proper business letter. Do NOT include placeholders like [NAME] — leave generic where info is unavailable.
`;

const LEGAL_DEMAND_PROMPT = (context: LetterContext) => `
You are a consumer protection attorney writing a formal demand letter.

Resort: ${context.resortName}
Identified Issues: ${context.misrepresentationClaims.join('; ')}
Contract violations: ${context.contractFlags.join('; ') || 'Perpetuity language, maintenance fee escalation'}
Round: ${context.roundNumber}

Write a firm legal demand letter that:
1. Cites specific consumer protection statutes (FTC Act Section 5, state timeshare acts)
2. Documents each misrepresentation claim
3. Demands full contract rescission within 21 days
4. States remedies available under applicable law
5. Notes regulatory complaint will be filed if unresponsive

Maintain professional legal tone. This letter may be used in regulatory filings.
`;

interface LetterContext {
  resortName: string;
  resortState: string | null;
  contractYear: number;
  purchasePrice: number;
  maintenanceFeeAnnual: number;
  outstandingMortgage: number;
  misrepresentationClaims: string[];
  contractFlags: string[];
  roundNumber: number;
  track: ExitTrack;
}

@Injectable()
export class LetterGeneratorService {
  private readonly logger = new Logger(LetterGeneratorService.name);
  private readonly anthropic: Anthropic;
  private readonly s3: S3Client;

  constructor(private readonly config: ConfigService) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async generateLetter(context: LetterContext): Promise<{
    letterText: string;
    s3Key: string;
    presignedUrl: string;
  }> {
    const prompt =
      context.track === 'DEED_BACK'
        ? DEED_BACK_PROMPT(context)
        : context.track === 'LEGAL_DEMAND'
          ? LEGAL_DEMAND_PROMPT(context)
          : DEED_BACK_PROMPT(context); // default to deed-back for other tracks

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected Claude response type');
    const letterText = block.text;

    // Store letter in S3
    const s3Key = `cases/letters/${randomUUID()}.txt`;
    const bucket = this.config.getOrThrow<string>('S3_BUCKET_NAME');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: Buffer.from(letterText, 'utf-8'),
        ContentType: 'text/plain',
        ServerSideEncryption: 'AES256',
      }),
    );

    // Generate 1-hour pre-signed URL for attorney review
    const presignedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
      { expiresIn: 3600 },
    );

    this.logger.log('Letter generated and stored', { s3Key, track: context.track, round: context.roundNumber });

    return { letterText, s3Key, presignedUrl };
  }
}
