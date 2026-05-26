import { Module } from '@nestjs/common';
import { AttorneyController } from './attorney.controller';
import { AttorneyRoutingService } from './attorney-routing.service';

@Module({
  controllers: [AttorneyController],
  providers: [AttorneyRoutingService],
})
export class AttorneyModule {}
