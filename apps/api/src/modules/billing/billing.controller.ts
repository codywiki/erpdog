import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { PERMISSION_CODES, type AuthenticatedUser } from "@erpdog/contracts";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { Payload } from "../../common/utils/payload";
import { BillingService } from "./billing.service";

@ApiBearerAuth()
@ApiTags("Billing")
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post("billing-runs")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  runBilling(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.billing.generateMonthlyBills(user, body);
  }

  @Get("bills")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
    PERMISSION_CODES.BILL_MANAGE,
  )
  listBills(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
    @Query("customerId") customerId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.billing.list(user, {
      periodMonth,
      customerId,
      status,
      page,
      pageSize,
    });
  }

  @Post("bills")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  createManualBill(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.billing.createManualBill(user, body);
  }

  @Get("bills/:id")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_OWN,
    PERMISSION_CODES.CUSTOMER_READ_ALL,
    PERMISSION_CODES.BILL_MANAGE,
  )
  getBill(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.billing.get(user, id);
  }

  @Post("bills/:id/submit")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.billing.transition(user, id, "INTERNAL_REVIEW", "bill.submit");
  }

  @Post("bills/:id/finance-review")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  financeReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.billing.transition(user, id, "FINANCE_REVIEW", "bill.review");
  }

  @Post("bills/:id/send-to-customer")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  sendToCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.billing.transition(
      user,
      id,
      "CUSTOMER_PENDING",
      "bill.customer_pending",
    );
  }

  @Post("bills/:id/confirm-customer")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  confirmCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.billing.confirmCustomer(user, id, body);
  }

  @Post("bills/:id/approve")
  @RequirePermissions(PERMISSION_CODES.BILL_APPROVE)
  approveReceivable(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.billing.approveReceivable(user, id, body);
  }

  @Post("bills/:id/evidence")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  updateEvidenceAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.billing.updateEvidenceAttachments(user, id, body);
  }

  @Post("bills/:id/mark-invoiced")
  @RequirePermissions(PERMISSION_CODES.RECEIVABLE_SETTLE)
  markInvoiced(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.billing.markInvoiced(user, id, body);
  }

  @Post("bills/:id/mark-received")
  @RequirePermissions(PERMISSION_CODES.RECEIVABLE_SETTLE)
  markReceived(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.billing.markReceived(user, id, body);
  }

  @Post("bills/:id/adjust")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.billing.adjust(user, id, body);
  }

  @Post("bills/:id/void")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  voidBill(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.billing.transition(user, id, "VOIDED", "bill.void");
  }
}
