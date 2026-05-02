import { Global, Module } from "@nestjs/common";

import { PeriodLockService } from "./period-lock.service";

@Global()
@Module({
  providers: [PeriodLockService],
  exports: [PeriodLockService],
})
export class PeriodsModule {}
