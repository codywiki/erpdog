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
import { ContractsService } from "./contracts.service";

@ApiBearerAuth()
@ApiTags("Contracts")
@Controller("contracts")
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
  )
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("customerId") customerId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.contracts.list(user, { customerId, status, page, pageSize });
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.contracts.create(user, body);
  }

  @Post("import")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  importContracts(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.contracts.importContracts(user, body);
  }

  @Get("charge-rule-templates")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
  )
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.contracts.listTemplates(user);
  }

  @Post("charge-rule-templates")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.contracts.createTemplate(user, body);
  }

  @Get(":id")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
  )
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.contracts.get(user, id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.contracts.update(user, id, body);
  }

  @Post(":id/charge-items")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  addChargeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.contracts.addChargeItem(user, id, body);
  }

  @Patch(":id/charge-items/:itemId")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  updateChargeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: Payload,
  ) {
    return this.contracts.updateChargeItem(user, id, itemId, body);
  }

  @Post(":id/charge-items/:itemId/deactivate")
  @RequirePermissions(PERMISSION_CODES.CONTRACT_WRITE)
  deactivateChargeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: Payload,
  ) {
    return this.contracts.deactivateChargeItem(user, id, itemId, body);
  }
}
