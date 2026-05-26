import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Transaction } from 'kafkajs';
import type { KafkaEvent } from '@exitforge/shared';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer!: Producer;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'negotiation-service'),
      brokers: this.config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
    });
    this.producer = kafka.producer({ transactionalId: 'negotiation-service-producer' });
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async emit<T>(topic: string, event: KafkaEvent<T>): Promise<void> {
    const tx: Transaction = await this.producer.transaction();
    try {
      await tx.send({ topic, messages: [{ key: event.aggregateId, value: JSON.stringify(event) }] });
      await tx.commit();
    } catch (err) {
      await tx.abort();
      this.logger.error({ event: 'kafka_emit_failed', topic, error: String(err) });
      throw err;
    }
  }
}
