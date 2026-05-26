import { Module } from "@nestjs/common";
import { CasesGateway } from "./cases.gateway";

@Module({
  providers: [CasesGateway],
  exports: [CasesGateway],
})
export class GatewayModule {}
