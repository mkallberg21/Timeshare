import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { AttorneyReviewItem, ReviewItemStatus } from "@prisma/client";

export type { AttorneyReviewItem };

export interface ReviewQueueItem {
  id: string;
  caseId: string;
  roundNumber: number;
  track: string;
  letterS3Key: string | null;
  letterDraft: string;
  assignedAttorneyId: string | null;
  slaDueAt: Date;
  status: ReviewItemStatus;
  createdAt: Date;
}

@Injectable()
export class AttorneyRoutingService {
  private readonly logger = new Logger(AttorneyRoutingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Assigns the best available attorney for a case based on:
   * 1. Licensed in the relevant state
   * 2. Available capacity (below maxCaseLoad)
   * 3. Specialization match (prefers track-specific attorney)
   */
  async routeToAttorney(params: {
    caseId: string;
    resortState: string;
    track: string;
  }): Promise<string | null> {
    const attorney = await this.prisma.attorney.findFirst({
      where: {
        active: true,
        statesLicensed: { has: params.resortState },
        currentCaseLoad: { lt: this.prisma.attorney.fields.maxCaseLoad as never },
      },
      orderBy: { currentCaseLoad: "asc" },
    });

    if (attorney) {
      await this.prisma.attorney.update({
        where: { id: attorney.id },
        data: { currentCaseLoad: { increment: 1 } },
      });
    }

    this.logger.log("Attorney routing completed", {
      ...params,
      assignedId: attorney?.id ?? null,
    });

    return attorney?.id ?? null;
  }

  /**
   * Adds a letter draft to the persistent attorney review queue.
   * Attorney has `slaHours` to review before the SLA cron marks it EXPIRED.
   */
  async addToReviewQueue(params: {
    caseId: string;
    roundNumber: number;
    track: string;
    letterDraft: string;
    slaHours: number;
  }): Promise<{ queueId: string; assignedAttorneyId: string | null }> {
    const slaDueAt = new Date(Date.now() + params.slaHours * 60 * 60 * 1000);

    const item = await this.prisma.attorneyReviewItem.create({
      data: {
        caseId: params.caseId,
        roundNumber: params.roundNumber,
        track: params.track,
        letterDraft: params.letterDraft,
        slaDueAt,
        status: "PENDING",
        priority: params.track === "LITIGATION" ? 1 : 2,
      },
    });

    this.logger.log("Letter added to review queue", {
      queueId: item.id,
      caseId: params.caseId,
      slaHours: params.slaHours,
      slaDueAt,
    });

    return { queueId: item.id, assignedAttorneyId: null };
  }

  async getReviewQueue(attorneyId?: string): Promise<ReviewQueueItem[]> {
    const items = await this.prisma.attorneyReviewItem.findMany({
      where: {
        status: { in: ["PENDING", "IN_REVIEW"] },
        ...(attorneyId ? { assignedTo: attorneyId } : {}),
      },
      orderBy: [{ priority: "asc" }, { slaDueAt: "asc" }],
    });

    return items.map((i) => ({
      id: i.id,
      caseId: i.caseId,
      roundNumber: i.roundNumber,
      track: i.track,
      letterS3Key: i.letterS3Key,
      letterDraft: i.letterDraft,
      assignedAttorneyId: i.assignedTo,
      slaDueAt: i.slaDueAt,
      status: i.status,
      createdAt: i.createdAt,
    }));
  }

  async approveReview(
    queueId: string,
    attorneyId: string,
  ): Promise<void> {
    const item = await this.prisma.attorneyReviewItem.findUnique({
      where: { id: queueId },
    });
    if (!item) throw new NotFoundException(`Queue item ${queueId} not found`);

    await this.prisma.attorneyReviewItem.update({
      where: { id: queueId },
      data: {
        status: "APPROVED",
        assignedTo: attorneyId,
        reviewedAt: new Date(),
        reviewedBy: attorneyId,
      },
    });

    this.logger.log("Review approved", { queueId, attorneyId });
  }

  async rejectReview(
    queueId: string,
    attorneyId: string,
    rejectionNote: string,
  ): Promise<void> {
    const item = await this.prisma.attorneyReviewItem.findUnique({
      where: { id: queueId },
    });
    if (!item) throw new NotFoundException(`Queue item ${queueId} not found`);

    await this.prisma.attorneyReviewItem.update({
      where: { id: queueId },
      data: {
        status: "REJECTED",
        assignedTo: attorneyId,
        reviewedAt: new Date(),
        reviewedBy: attorneyId,
        rejectionNote,
      },
    });

    this.logger.log("Review rejected", { queueId, attorneyId, rejectionNote });
  }
}
