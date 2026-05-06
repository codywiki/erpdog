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
import { FinanceService } from "./finance.service";

@ApiBearerAuth()
@ApiTags("Finance")
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("extra-charge-categories")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_ALL,
    PERMISSION_CODES.CUSTOMER_READ_OWN,
  )
  listExtraChargeCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listExtraChargeCategories(user);
  }

  @Post("extra-charge-categories")
  @RequirePermissions(PERMISSION_CODES.BILL_MANAGE)
  createExtraChargeCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createExtraChargeCategory(user, body);
  }

  @Get("extra-charges")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_ALL,
    PERMISSION_CODES.CUSTOMER_READ_OWN,
  )
  listExtraCharges(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
    @Query("customerId") customerId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listExtraCharges(user, {
      periodMonth,
      customerId,
      page,
      pageSize,
    });
  }

  @Post("extra-charges")
  @RequirePermissions(
    PERMISSION_CODES.BILL_MANAGE,
    PERMISSION_CODES.CONTRACT_WRITE,
  )
  createExtraCharge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createExtraCharge(user, body);
  }

  @Post("extra-charges/:id/cancel")
  @RequirePermissions(
    PERMISSION_CODES.BILL_MANAGE,
    PERMISSION_CODES.CONTRACT_WRITE,
  )
  cancelExtraCharge(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.finance.cancelExtraCharge(user, id, body);
  }

  @Get("invoices")
  @RequirePermissions(PERMISSION_CODES.INVOICE_MANAGE)
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listInvoices(user, { page, pageSize });
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
  listReceipts(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listReceipts(user, { page, pageSize });
  }

  @Post("receipts")
  @RequirePermissions(PERMISSION_CODES.RECEIPT_MANAGE)
  createReceipt(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createReceipt(user, body);
  }

  @Post("receipts/:id/reverse")
  @RequirePermissions(PERMISSION_CODES.RECEIPT_MANAGE)
  reverseReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.finance.reverseReceipt(user, id);
  }

  @Get("cost-categories")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  listCostCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listCostCategories(user);
  }

  @Post("cost-categories")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  createCostCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createCostCategory(user, body);
  }

  @Get("cost-entries")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  listCostEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
    @Query("customerId") customerId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listCostEntries(user, {
      periodMonth,
      customerId,
      page,
      pageSize,
    });
  }

  @Post("cost-entries")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  createCostEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createCostEntry(user, body);
  }

  @Get("payment-recipients")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  listPaymentRecipients(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listPaymentRecipients(user, { q, page, pageSize });
  }

  @Post("payment-recipients")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  createPaymentRecipient(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createPaymentRecipient(user, body);
  }

  @Patch("payment-recipients/:id")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  updatePaymentRecipient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.finance.updatePaymentRecipient(user, id, body);
  }

  @Delete("payment-recipients/:id")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  removePaymentRecipient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.finance.removePaymentRecipient(user, id);
  }

  @Get("payables")
  @RequirePermissions(
    PERMISSION_CODES.COST_MANAGE,
    PERMISSION_CODES.PAYABLE_SETTLE,
    PERMISSION_CODES.PAYMENT_PAY,
  )
  listPayables(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listPayables(user, { status, page, pageSize });
  }

  @Post("payables")
  @RequirePermissions(PERMISSION_CODES.COST_MANAGE)
  createPayable(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createPayable(user, body);
  }

  @Post("payables/:id/confirm")
  @RequirePermissions(PERMISSION_CODES.PAYABLE_SETTLE)
  confirmPayable(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.finance.confirmPayable(user, id, body);
  }

  @Get("payment-requests")
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
    PERMISSION_CODES.PAYMENT_REQUEST_APPROVE,
    PERMISSION_CODES.PAYMENT_PAY,
  )
  listPaymentRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listPaymentRequests(user, { page, pageSize });
  }

  @Post("payment-requests")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_CREATE)
  createPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createPaymentRequest(user, body);
  }

  @Post("payment-requests/:id/submit")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_CREATE)
  submitPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.finance.submitPaymentRequest(user, id);
  }

  @Post("payment-requests/:id/approve")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_APPROVE)
  approvePaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.finance.approvePaymentRequest(user, id, body);
  }

  @Post("payment-requests/:id/reject")
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REQUEST_APPROVE)
  rejectPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.finance.rejectPaymentRequest(user, id, body);
  }

  @Post("payment-requests/:id/cancel")
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
    PERMISSION_CODES.PAYMENT_REQUEST_APPROVE,
  )
  cancelPaymentRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.finance.cancelPaymentRequest(user, id, body);
  }

  @Get("payments")
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_PAY,
    PERMISSION_CODES.PAYABLE_SETTLE,
  )
  listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listPayments(user, { page, pageSize });
  }

  @Post("payments")
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_PAY,
    PERMISSION_CODES.PAYABLE_SETTLE,
  )
  createPayment(@CurrentUser() user: AuthenticatedUser, @Body() body: Payload) {
    return this.finance.createPayment(user, body);
  }

  @Post("payments/:id/reverse")
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_PAY,
    PERMISSION_CODES.PAYABLE_SETTLE,
  )
  reversePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Payload,
  ) {
    return this.finance.reversePayment(user, id, body);
  }

  @Get("periods/:periodMonth")
  @RequirePermissions(
    PERMISSION_CODES.PERIOD_CLOSE,
    PERMISSION_CODES.REPORT_VIEW,
  )
  periodStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("periodMonth") periodMonth: string,
  ) {
    return this.finance.periodStatus(user, periodMonth);
  }

  @Post("periods/:periodMonth/close")
  @RequirePermissions(PERMISSION_CODES.PERIOD_CLOSE)
  closePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param("periodMonth") periodMonth: string,
    @Body() body: Payload,
  ) {
    return this.finance.closePeriod(user, periodMonth, body);
  }

  @Get("attachments")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_ALL,
    PERMISSION_CODES.CUSTOMER_READ_OWN,
  )
  listAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ownerType") ownerType?: string,
    @Query("ownerId") ownerId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.finance.listAttachments(user, {
      ownerType,
      ownerId,
      page,
      pageSize,
    });
  }

  @Get("attachments/:id/download-url")
  @RequirePermissions(
    PERMISSION_CODES.CUSTOMER_READ_ALL,
    PERMISSION_CODES.CUSTOMER_READ_OWN,
  )
  attachmentDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("disposition") disposition?: string,
  ) {
    return this.finance.attachmentDownloadUrl(user, id, disposition);
  }

  @Post("attachments/presign-upload")
  @RequirePermissions(
    PERMISSION_CODES.BILL_MANAGE,
    PERMISSION_CODES.BILL_APPROVE,
    PERMISSION_CODES.RECEIVABLE_SETTLE,
    PERMISSION_CODES.INVOICE_MANAGE,
    PERMISSION_CODES.RECEIPT_MANAGE,
    PERMISSION_CODES.COST_MANAGE,
    PERMISSION_CODES.PAYABLE_SETTLE,
    PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
    PERMISSION_CODES.CONTRACT_WRITE,
  )
  createAttachmentUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createAttachmentUploadUrl(user, body);
  }

  @Post("attachments")
  @RequirePermissions(
    PERMISSION_CODES.BILL_MANAGE,
    PERMISSION_CODES.BILL_APPROVE,
    PERMISSION_CODES.RECEIVABLE_SETTLE,
    PERMISSION_CODES.INVOICE_MANAGE,
    PERMISSION_CODES.RECEIPT_MANAGE,
    PERMISSION_CODES.COST_MANAGE,
    PERMISSION_CODES.PAYABLE_SETTLE,
    PERMISSION_CODES.PAYMENT_REQUEST_CREATE,
    PERMISSION_CODES.CONTRACT_WRITE,
  )
  createAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Payload,
  ) {
    return this.finance.createAttachment(user, body);
  }

  @Get("reports/customer-profit/export")
  @RequirePermissions(PERMISSION_CODES.REPORT_VIEW)
  customerProfitExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
  ) {
    return this.finance.customerProfitWorkbook(user, periodMonth);
  }

  @Get("reports/customer-profit")
  @RequirePermissions(PERMISSION_CODES.REPORT_VIEW)
  customerProfit(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
  ) {
    return this.finance.customerProfit(user, periodMonth);
  }

  @Get("reports/owner-ranking/export")
  @RequirePermissions(PERMISSION_CODES.REPORT_VIEW)
  ownerRankingExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
  ) {
    return this.finance.ownerRankingWorkbook(user, periodMonth);
  }

  @Get("reports/owner-ranking")
  @RequirePermissions(PERMISSION_CODES.REPORT_VIEW)
  ownerRanking(
    @CurrentUser() user: AuthenticatedUser,
    @Query("periodMonth") periodMonth?: string,
  ) {
    return this.finance.ownerRanking(user, periodMonth);
  }
}
