import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { MLClientService } from '../ml/ml-client.service';

@Module({
  controllers: [CasesController],
  providers: [CasesService, MLClientService],
  exports: [CasesService],
})
export class CasesModule {}
