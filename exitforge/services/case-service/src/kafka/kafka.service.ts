import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Kafka,
  Producer,
  ProducerRecord,
  Transaction,
  CompressionTypes,
} from 'kafkajs';
import { randomUUID } from 'crypto';
import type { KafkaEvent, KafkaEventType } from '@exitforge/shared';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka!: Kafka;
  private producer!: Producer;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const brokers = (this.config.getOrThrow<string>('KAFKA_BROKERS'))
      .split(',')
      .map((b) => b.trim());

    this.kafka = new Kafka({
      clientId: this.config.getOrThrow<string>('KAFKA_CLIENT_ID'),
      brokers,
    });

    this.producer = this.kafka.producer({
      // Idempotent producer — exactly-once delivery guarantee
      idempotent: true,
      transactionalId: `case-service-${randomUUID()}`,
      maxInFlightRequests: 1,
    });

    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  /**
   * Emit a single event. Uses Kafka transactions for exactly-once semantics.
   */
  async emit<T>(
    eventType: KafkaEventType,
    aggregateId: string,
    payload: T,
    correlationId: string = randomUUID(),
  ): Promise<void> {
    const event: KafkaEvent<T> = {
      eventId: randomUUID(),
      eventType,
      aggregateId,
      timestamp: new Date().toISOString(),
      version: 1,
      payload,
      metadata: {
        correlationId,
        causationId: correlationId,
        service: 'case-service',
      },
    };

    const topic = this.topicForEvent(eventType);
    let transaction: Transaction | undefined;

    try {
      transaction = await this.producer.transaction();

      await transaction.send({
        topic,
        compression: CompressionTypes.GZIP,
        messages: [
          {
            key: aggregateId,
            value: JSON.stringify(event),
            headers: {
              correlationId,
              eventType,
              service: 'case-service',
            },
          },
        ],
      } satisfies ProducerRecord);

      await transaction.commit();
      this.logger.verbose(`Emitted ${eventType} for aggregate ${aggregateId}`);
    } catch (err: unknown) {
      await transaction?.abort();
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to emit ${eventType}: ${message}`);
      throw new InternalServerErrorException(`Event emission failed: ${eventType}`);
    }
  }

  private topicForEvent(eventType: KafkaEventType): string {
    // Route events to domain-scoped topics
    if (eventType.startsWith('case.')) return 'exitforge.cases';
    if (eventType.startsWith('message.')) return 'exitforge.messages';
    if (eventType.startsWith('document.')) return 'exitforge.documents';
    return 'exitforge.events';
  }
}
