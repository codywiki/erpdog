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
import { PlatformService } from "./platform.service";

@ApiBearerAuth()
@ApiTags("Platform")
@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("super-admins")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  listSuperAdmins(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.platform.listSuperAdmins(user, { page, pageSize });
  }

  @Post("super-admins")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  createSuperAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.platform.createSuperAdmin(user, body);
  }

  @Patch("super-admins/:id")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  updateSuperAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.platform.updateSuperAdmin(user, id, body);
  }

  @Delete("super-admins/:id")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  deleteSuperAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.platform.deleteSuperAdmin(user, id);
  }

  @Get("tenants")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  listTenants(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.platform.listTenants(user, { page, pageSize });
  }

  @Post("tenants")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  createTenant(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.platform.createTenant(user, body);
  }

  @Patch("tenants/:id")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  updateTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.platform.updateTenant(user, id, body);
  }

  @Delete("tenants/:id")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  deleteTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.platform.deleteTenant(user, id);
  }

  @Patch("tenants/:tenantId/users/:userId")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  updateTenantUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() body: Payload,
  ) {
    return this.platform.updateTenantUser(user, tenantId, userId, body);
  }

  @Delete("tenants/:tenantId/users/:userId")
  @RequirePermissions(PERMISSION_CODES.TENANT_MANAGE)
  deleteTenantUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
  ) {
    return this.platform.deleteTenantUser(user, tenantId, userId);
  }
}
