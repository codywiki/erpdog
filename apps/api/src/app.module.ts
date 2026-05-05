import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";

import { parseServerEnv } from "@erpdog/config";

import { AuditModule } from "./common/audit/audit.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { PeriodsModule } from "./common/periods/periods.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { SigningEntitiesModule } from "./modules/signing-entities/signing-entities.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: parseServerEnv,
    }),
    PrismaModule,
    AuditModule,
    PeriodsModule,
    HealthModule,
    AuthModule,
    PlatformModule,
    IdentityModule,
    CustomersModule,
    SigningEntitiesModule,
    ContractsModule,
    BillingModule,
    FinanceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
