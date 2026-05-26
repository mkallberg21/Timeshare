import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SlaSchedulerService } from "./sla-scheduler.service";
import { LegalKafkaModule } from "../kafka/kafka.module";

@Module({
  imports: [ScheduleModule.forRoot(), LegalKafkaModule],
  providers: [SlaSchedulerService],
})
export class SlaModule {}
