import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { PERMISSION_CODES, type AuthenticatedUser } from "@erpdog/contracts";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { Payload } from "../../common/utils/payload";
import { FinanceService } from "./finance.service";

@ApiBearerAuth()
@ApiTags("Finance")
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("extra-charge-categories")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_READ_ALL, PERMISSION_CODES.CUSTOMER_READ_OWN)
  listExtraChargeCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listExtraChargeCategories(user);
  }

  @Post("extra-charge-categories")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  createExtraChargeCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload
  ) {
    return this.finance.createExtraChargeCategory(user, body);
  }

  @Get("extra-charges")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_READ_ALL, PERMISSION_CODES.CUSTOMER_READ_OWN)
  listExtraCharges(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
    @Query("customerId") customerId?: string
  ) {
    return this.finance.listExtraCharges(user, { periodMonth, customerId });
  }

  @Post("extra-charges")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE, PERMISSION_CODES.CONTRACT_WRITE)
  createExtraCharge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload
  ) {
    return this.finance.createExtraCharge(user, body);
  }

  @Get("invoices")
  @RequirePermissions(PERMISSION_CODES.INVOICE_MANAGE)
  listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listInvoices(user);
  }

  @Post("invoices")
  @RequirePermissions(PERMISSION_CODES.INVOICE_MANAGE)
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createInvoice(user, body);
  }

  @Post("invoices/:id/void")
  @RequirePermissions(PERMISSION_CODES.INVOICE_MANAGE)
  voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.finance.voidInvoice(user, id);
  }

  @Get("receipts")
  @RequirePermissions(PERMISSION_CODES.RECEIPT_MANAGE)
  listReceipts(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listReceipts(user);
  }

  @Post("receipts")
  @RequirePermissions(PERMISSION_CODES.RECEIPT_MANAGE)
  createReceipt(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createReceipt(user, body);
  }

  @Post("receipts/:id/reverse")
  @RequirePermissions(PERMISSION_CODES.RECEIPT_MANAGE)
  reverseReceipt(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.finance.reverseReceipt(user, id);
  }

  @Get("cost-categories")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  listCostCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listCostCategories(user);
  }

  @Post("cost-categories")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  createCostCategory(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createCostCategory(user, body);
  }

  @Get("cost-entries")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  listCostEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
    @Query("customerId") customerId?: string
  ) {
    return this.finance.listCostEntries(user, { periodMonth, customerId });
  }

  @Post("cost-entries")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  createCostEntry(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createCostEntry(user, body);
  }

  @Get("payables")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE, PERMISSION_CODES.PAYMENT_PAY)
  listPayables(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listPayables(user);
  }

  @Post("payables")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  createPayable(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createPayable(user, body);
  }

  @Get("payment-requests")
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
    PERMISSION_CODES.PAYMENT_REQUEST_APPROVE,
    PERMISSION_CODES.PAYMENT_PAY
  )
  listPaymentRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listPaymentRequests(user);
  }

  @Post("payment-requests")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_CREATE)
  createPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload
  ) {
    return this.finance.createPaymentRequest(user, body);
  }

  @Post("payment-requests/:id/submit")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_CREATE)
  submitPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ) {
    return this.finance.submitPaymentRequest(user, id);
  }

  @Post("payment-requests/:id/approve")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_APPROVE)
  approvePaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload
  ) {
    return this.finance.approvePaymentRequest(user, id, body);
  }

  @Post("payment-requests/:id/reject")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_APPROVE)
  rejectPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload
  ) {
    return this.finance.rejectPaymentRequest(user, id, body);
  }

  @Get("payments")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_PAY)
  listPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listPayments(user);
  }

  @Post("payments")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_PAY)
  createPayment(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createPayment(user, body);
  }

  @Post("periods/:month/close")
  @RequirePermissions(PERMISSION_CODES.PERIOD_CLOSE)
  closePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param("month") month: string,
    @Body() body: Payload
  ) {
    return this.finance.closePeriod(user, month, body);
  }

  @Post("periods/:month/reopen")
  @RequirePermissions(PERMISSION_CODES.PERIOD_REOPEN)
  reopenPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param("month") month: string,
    @Body() body: Payload
  ) {
    return this.finance.reopenPeriod(user, month, body);
  }

  @Get("attachments")
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_READ_ALL, PERMISSION_CODES.CUSTOMER_READ_OWN)
  listAttachments(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listAttachments(user);
  }

  @Post("attachments")
  @RequirePermissions(
    PERMISSION_CODES.BILL_MANAGE,
    PERMISSION_CODES.INVOICE_MANAGE,
    PERMISSION_CODES.RECEIPT_MANAGE,
    PERMISSION_CODES.COST_MANAGE,
    PERMISSION_CODES.PAYMENT_REQUEST_CREATE
  )
  createAttachment(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createAttachment(user, body);
  }

  @Get("reports/customer-profit")
  @RequirePermissions(PERMISSION_CODES.REPORT_VIEW)
  customerProfit(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string
  ) {
    return this.finance.customerProfit(user, periodMonth);
  }

  @Get("reports/owner-ranking")
  @RequirePermissions(PERMISSION_CODES.REPORT_VIEW)
  ownerRanking(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string
  ) {
    return this.finance.ownerRanking(user, periodMonth);
  }
}
