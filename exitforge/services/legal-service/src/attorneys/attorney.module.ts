import { Module } from '@nestjs/common';
import { AttorneyController } from './attorney.controller';
import { AttorneyRoutingService } from './attorney-routing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttorneyController],
  providers: [AttorneyRoutingService],
  exports: [AttorneyRoutingService],
})
export class AttorneyModule {}
