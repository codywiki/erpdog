import {
  Body,
  Controller,
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
  @RequirePermissions(PERMISSION_CODES.USER_MANAGE)
  listUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.identity.listUsers(user, { page, pageSize });
  }

  @Post("identity/users")
  @RequirePermissions(PERMISSION_CODES.USER_MANAGE)
  createUser(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.identity.createUser(user, body);
  }

  @Patch("identity/users/:id")
  @RequirePermissions(PERMISSION_CODES.USER_MANAGE)
  updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.identity.updateUser(user, id, body);
  }

  @Get("identity/roles")
  @RequirePermissions(PERMISSION_CODES.USER_MANAGE)
  listRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.identity.listRoles(user);
  }

  @Patch("identity/roles/:id/permissions")
  @RequirePermissions(PERMISSION_CODES.USER_MANAGE)
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
