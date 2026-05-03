import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { PERMISSION_CODES, type AuthenticatedUser } from "@erpdog/contracts";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { Payload } from "../../common/utils/payload";
import { SigningEntitiesService } from "./signing-entities.service";

@ApiBearerAuth()
@ApiTags("Signing entities")
@Controller("signing-entities")
export class SigningEntitiesController {
  constructor(private readonly signingEntities: SigningEntitiesService) {}

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
  )
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.signingEntities.list(user, { q, page, pageSize });
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.signingEntities.create(user, body);
  }

  @Get(":id")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
  )
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.signingEntities.get(user, id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.signingEntities.update(user, id, body);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.signingEntities.remove(user, id);
  }
}
