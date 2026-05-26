import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { KafkaService } from "../kafka/kafka.service";

@Injectable()
export class SlaSchedulerService {
  private readonly logger = new Logger(SlaSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  /**
   * Runs every 5 minutes.
   * Marks PENDING/IN_REVIEW items as EXPIRED when past SLA deadline.
   * Emits alert.attorney_sla_breached Kafka event for each expired item.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireSlaBreaches(): Promise<void> {
    const now = new Date();

    const expired = await this.prisma.attorneyReviewItem.findMany({
      where: {
        status: { in: ["PENDING", "IN_REVIEW"] },
        slaDueAt: { lt: now },
      },
      select: { id: true, caseId: true, assignedTo: true, roundNumber: true, track: true },
    });

    if (expired.length === 0) return;

    await this.prisma.attorneyReviewItem.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { status: "EXPIRED" },
    });

    for (const item of expired) {
      try {
        await this.kafka.emit("exitforge.legal.events", item.caseId, {
          event: "alert.attorney_sla_breached",
          reviewItemId: item.id,
          caseId: item.caseId,
          assignedTo: item.assignedTo,
          roundNumber: item.roundNumber,
          track: item.track,
          breachedAt: now.toISOString(),
        });
      } catch (err) {
        this.logger.error("Failed to emit SLA breach event", { itemId: item.id, err });
      }
    }

    this.logger.warn(`Expired ${expired.length} SLA-breached review items`);
  }
}
