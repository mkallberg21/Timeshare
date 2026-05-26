import { Module } from '@nestjs/common';
import { NegotiationController } from './negotiation.controller';
import { KafkaModule } from '../kafka/kafka.module';
import { LetterGeneratorService } from '../letters/letter-generator.service';

@Module({
  imports: [KafkaModule],
  controllers: [NegotiationController],
  providers: [LetterGeneratorService],
})
export class NegotiationModule {}
