import { Module } from "@nestjs/common";

import { ExcelModule } from "../../common/excel/excel.module";
import { StorageModule } from "../../common/storage/storage.module";
import { CustomersModule } from "../customers/customers.module";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  imports: [CustomersModule, ExcelModule, StorageModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
