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
import { CustomersService } from "./customers.service";

@ApiBearerAuth()
@ApiTags("Customers")
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
  )
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.customers.list(user, { q, status, page, pageSize });
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.customers.create(user, body);
  }

  @Post("import")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  importCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.customers.importCustomers(user, body);
  }

  @Get("import-template")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  customerImportTemplate() {
    return this.customers.customerImportTemplate();
  }

  @Post("import-xlsx")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  importCustomersWorkbook(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.customers.importCustomersWorkbook(user, body);
  }

  @Get(":id")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
  )
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.customers.get(user, id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.customers.update(user, id, body);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.customers.remove(user, id);
  }

  @Post(":id/owners")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  setOwners(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.customers.setOwners(user, id, body);
  }

  @Post(":id/contacts")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  addContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.customers.addContact(user, id, body);
  }

  @Post(":id/billing-profiles")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_WRITE)
  addBillingProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.customers.addBillingProfile(user, id, body);
  }
}
