import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface AttorneyProfile {
  id: string;
  name: string;
  barNumber: string;
  statesLicensed: string[];
  specialization: string;
  firmName: string;
  contactEmail: string;
  active: boolean;
  currentCaseLoad: number;
  maxCaseLoad: number;
}

export interface ReviewQueueItem {
  caseId: string;
  roundNumber: number;
  track: string;
  letterS3Key: string;
  letterDraft: string;
  assignedAttorneyId: string | null;
  slaHours: number;
  createdAt: Date;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
}

@Injectable()
export class AttorneyRoutingService {
  private readonly logger = new Logger(AttorneyRoutingService.name);

  // In-memory queue for development — replace with persistent store in production
  private readonly reviewQueue: Map<string, ReviewQueueItem> = new Map();

  constructor(private readonly config: ConfigService) {}

  /**
   * Assigns the best available attorney for a case based on:
   * 1. Licensed in the relevant state
   * 2. Available capacity (below maxCaseLoad)
   * 3. Specialization match
   */
  async routeToAttorney(params: {
    caseId: string;
    resortState: string;
    track: string;
  }): Promise<string | null> {
    // TODO: Replace with DB query via Prisma
    // For now, returns a placeholder — wire to attorneys table
    this.logger.log('Attorney routing requested', params);
    return null;
  }

  /**
   * Adds a letter draft to the attorney review queue.
   * Attorney has `slaHours` to review before auto-escalation.
   */
  async addToReviewQueue(params: {
    caseId: string;
    roundNumber: number;
    track: string;
    letterDraft: string;
    slaHours: number;
  }): Promise<{ queueId: string; assignedAttorneyId: string | null }> {
    const queueId = `${params.caseId}-round${params.roundNumber}`;

    const item: ReviewQueueItem = {
      caseId: params.caseId,
      roundNumber: params.roundNumber,
      track: params.track,
      letterS3Key: '',
      letterDraft: params.letterDraft,
      assignedAttorneyId: null,
      slaHours: params.slaHours,
      createdAt: new Date(),
      status: 'PENDING',
    };

    this.reviewQueue.set(queueId, item);

    this.logger.log('Letter added to review queue', {
      queueId,
      caseId: params.caseId,
      slaHours: params.slaHours,
    });

    return { queueId, assignedAttorneyId: null };
  }

  async getReviewQueue(attorneyId?: string): Promise<ReviewQueueItem[]> {
    const items = Array.from(this.reviewQueue.values());
    if (attorneyId) {
      return items.filter((i) => i.assignedAttorneyId === attorneyId);
    }
    return items.filter((i) => i.status === 'PENDING' || i.status === 'IN_REVIEW');
  }

  async approveReview(queueId: string, attorneyId: string): Promise<void> {
    const item = this.reviewQueue.get(queueId);
    if (!item) throw new NotFoundException(`Queue item ${queueId} not found`);
    item.status = 'APPROVED';
    item.assignedAttorneyId = attorneyId;
    this.logger.log('Review approved', { queueId, attorneyId });
  }
}
