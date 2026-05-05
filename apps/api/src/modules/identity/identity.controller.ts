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
import { IdentityService } from "./identity.service";

@ApiBearerAuth()
@ApiTags("Identity")
@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get("identity/users")
  listUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.identity.listUsers(user, { page, pageSize });
  }

  @Post("identity/users")
  createUser(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.identity.createUser(user, body);
  }

  @Patch("identity/users/:id")
  updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.identity.updateUser(user, id, body);
  }

  @Delete("identity/users/:id")
  deleteUser(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.identity.deleteUser(user, id);
  }

  @Get("identity/roles")
  listRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.identity.listRoles(user);
  }

  @Patch("identity/roles/:id/permissions")
  updateRolePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.identity.updateRolePermissions(user, id, body);
  }

  @Get("audit-logs")
  @RequirePermissions(PERMISSION_CODES.AUDIT_VIEW)
  listAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.identity.listAuditLogs(user, {
      action,
      entityType,
      entityId,
      page,
      pageSize,
    });
  }
}
