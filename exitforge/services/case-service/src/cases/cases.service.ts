import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Case, Timeshare } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaService } from '../kafka/kafka.service';
import { MLClientService } from '../ml/ml-client.service';
import type { CreateCaseDto } from './dto/create-case.dto';
import type {
  CaseCreatedPayload,
  CaseStatusChangedPayload,
  FeeCalculation,
} from '@exitforge/shared';
import { randomUUID } from 'crypto';

const FEE_RATE = 0.07 as const;
const MAINTENANCE_FEE_YEARS = 5 as const;

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly mlClient: MLClientService,
    private readonly config: ConfigService,
  ) {}

  async createCase(clientId: string, dto: CreateCaseDto) {
    const correlationId = randomUUID();

    const createdCase = await this.prisma.case.create({
      data: {
        clientId,
        status: 'INTAKE',
        timeshare: {
          create: {
            resortId: dto.resortId,
            contractYear: dto.contractYear,
            purchasePrice: dto.purchasePrice,
            maintenanceFeeAnnual: dto.maintenanceFeeAnnual,
            outstandingMortgage: dto.outstandingMortgage,
            contractS3Key: dto.contractS3Key,
          },
        },
      },
      include: { timeshare: { include: { resort: true } }, client: true },
    });

    // Emit case.created — triggers AI orchestrator via Kafka consumer
    await this.kafka.emit<CaseCreatedPayload>(
      'case.created',
      createdCase.id,
      { caseId: createdCase.id, clientId },
      correlationId,
    );

    this.logger.log(`Case created: ${createdCase.id} for client ${clientId}`);
    return createdCase;
  }

  async getCaseForClient(caseId: string, clientId: string) {
    const foundCase = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        timeshare: { include: { resort: true } },
        negotiations: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
        fee: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
        attorney: true,
        client: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!foundCase) throw new NotFoundException('Case not found');
    if (foundCase.clientId !== clientId) throw new ForbiddenException('Access denied');

    return foundCase;
  }

  async getMLTimeline(caseId: string) {
    const foundCase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { timeshare: { include: { resort: true } } },
    });

    return this.mlClient.predictTimeline(foundCase);
  }

  async calculateFeeEstimate(caseId: string): Promise<FeeCalculation> {
    const foundCase = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { timeshare: true, fee: true },
    });

    const timeshare = foundCase.timeshare;
    const mortgageBasis = timeshare?.outstandingMortgage ?? 0;
    const maintenanceBasis = (timeshare?.maintenanceFeeAnnual ?? 0) * MAINTENANCE_FEE_YEARS;
    const totalBasis = mortgageBasis + maintenanceBasis;
    const feeAmount = totalBasis * FEE_RATE;

    return {
      caseId,
      basisAmount: totalBasis,
      rateDecimal: FEE_RATE,
      feeAmount,
      status: foundCase.fee?.status ?? 'PENDING',
      escrowId: foundCase.fee?.escrowId ?? null,
    };
  }

  async getNegotiations(caseId: string) {
    return this.prisma.negotiation.findMany({
      where: { caseId },
      orderBy: [{ roundNumber: 'asc' }],
    });
  }

  async sendMessage(caseId: string, clientId: string, content: string) {
    // Verify the case belongs to this client before accepting the message
    const foundCase = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!foundCase) throw new NotFoundException('Case not found');
    if (foundCase.clientId !== clientId) throw new ForbiddenException('Access denied');

    const message = await this.prisma.message.create({
      data: { caseId, senderType: 'CLIENT', content },
    });

    // Emit async — AI orchestrator will respond in < 2 min
    await this.kafka.emit(
      'message.received',
      caseId,
      { caseId, messageId: message.id, content },
      randomUUID(),
    );

    return message;
  }

  async updateCaseStatus(
    caseId: string,
    newStatus: Case['status'],
    triggeredBy: string,
    correlationId: string = randomUUID(),
  ) {
    const current = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedCase = await tx.case.update({
        where: { id: caseId },
        data: { status: newStatus, updatedAt: new Date() },
      });

      await tx.caseEvent.create({
        data: {
          caseId,
          eventType: 'case.status.changed',
          triggeredBy,
          metadataJson: {
            previousStatus: current.status,
            newStatus,
          },
        },
      });

      return updatedCase;
    });

    await this.kafka.emit<CaseStatusChangedPayload>(
      'case.status.changed',
      caseId,
      {
        caseId,
        previousStatus: current.status,
        newStatus,
        triggeredBy,
      },
      correlationId,
    );

    return updated;
  }

  async getPresignedUploadUrl(
    caseId: string,
    clientId: string,
    filename: string,
  ): Promise<{ uploadUrl: string; s3Key: string; expiresAt: string }> {
    // Verify ownership
    const foundCase = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!foundCase) throw new NotFoundException('Case not found');
    if (foundCase.clientId !== clientId) throw new ForbiddenException('Access denied');

    // S3 keys are scoped per case — never expose bucket root
    const ext = filename.split('.').pop() ?? 'bin';
    const s3Key = `cases/${caseId}/uploads/${randomUUID()}.${ext}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // TODO: generate actual pre-signed URL via @aws-sdk/s3-request-presigner
    // Returning placeholder — wire AWS SDK in production
    return {
      uploadUrl: `https://${this.config.get('S3_BUCKET_NAME')}.s3.amazonaws.com/${s3Key}`,
      s3Key,
      expiresAt,
    };
  }
}
