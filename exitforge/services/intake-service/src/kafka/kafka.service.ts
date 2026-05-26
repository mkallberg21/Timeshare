import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { randomUUID } from 'crypto';
import type { KafkaEvent, KafkaEventType } from '@exitforge/shared';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka!: Kafka;
  private producer!: Producer;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'intake-service'),
      brokers: this.config.getOrThrow<string>('KAFKA_BROKERS').split(','),
      logLevel: logLevel.ERROR,
    });
    this.producer = this.kafka.producer({ transactionalId: `intake-producer-${randomUUID()}` });
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

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
        service: 'intake-service',
      },
    };

    await this.producer.send({
      topic: eventType,
      messages: [{ key: aggregateId, value: JSON.stringify(event) }],
    });

    this.logger.debug('Kafka event emitted', { eventType, aggregateId });
  }
}
