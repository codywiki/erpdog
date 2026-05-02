import { Module } from "@nestjs/common";

import { ExcelModule } from "../../common/excel/excel.module";
import { CustomersModule } from "../customers/customers.module";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

@Module({
  imports: [CustomersModule, ExcelModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
