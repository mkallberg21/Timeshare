import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';

@Module({
  imports: [HttpModule],
  controllers: [IntakeController],
  providers: [IntakeService],
})
export class IntakeModule {}
