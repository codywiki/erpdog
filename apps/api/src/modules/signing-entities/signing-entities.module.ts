import { Module } from "@nestjs/common";

import { SigningEntitiesController } from "./signing-entities.controller";
import { SigningEntitiesService } from "./signing-entities.service";

@Module({
  controllers: [SigningEntitiesController],
  providers: [SigningEntitiesService],
  exports: [SigningEntitiesService],
})
export class SigningEntitiesModule {}
