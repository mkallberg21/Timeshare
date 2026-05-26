import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Producer, CompressionTypes } from "kafkajs";
import { randomUUID } from "crypto";

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer!: Producer;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.config
      .getOrThrow<string>("KAFKA_BROKERS")
      .split(",")
      .map((b) => b.trim());
    const kafka = new Kafka({
      clientId: this.config.getOrThrow<string>("KAFKA_CLIENT_ID"),
      brokers,
    });
    this.producer = kafka.producer({ idempotent: true });
    await this.producer.connect();
    this.logger.log("Kafka producer connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async emit<T>(topic: string, key: string, payload: T): Promise<void> {
    await this.producer.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key,
          value: JSON.stringify({
            eventId: randomUUID(),
            timestamp: new Date().toISOString(),
            payload,
          }),
        },
      ],
    });
  }
}
