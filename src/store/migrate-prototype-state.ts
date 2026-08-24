import { createCanonicalDemoData, DEMO_STATE_VERSION } from '../data/demo-data'
import type {
  HetReview,
  NextActionOverride,
  Order,
  PrototypeData,
  SchoolBenefit,
  SchoolPayment,
  SiplahProcess,
  VendorBatch,
} from '../domain/types'

interface LegacyHetReviewV1 extends HetReview {
  hetTotalAmount: number
}

interface LegacySiplahProcessV1 extends SiplahProcess {
  adminCompleted: boolean
}

interface LegacySchoolPaymentV1 extends Omit<SchoolPayment, 'schoolPaidAmount'> {
  amount: number
}

type LegacySchoolBenefitV1 = Omit<SchoolBenefit, 'baseAmount' | 'obligationAmount'>

interface LegacyNextActionControlV1 {
  override: NextActionOverride | null
  snoozedUntil: string | null
}

interface LegacyOrderV1 extends Omit<
  Order,
  | 'arkasBudgetAmount'
  | 'hetReviewedAmount'
  | 'finalInvoiceAmount'
  | 'het'
  | 'siplah'
  | 'schoolPayment'
  | 'benefit'
  | 'nextActionControl'
> {
  finalInvoiceAmount: number
  het: LegacyHetReviewV1
  siplah: LegacySiplahProcessV1
  schoolPayment: LegacySchoolPaymentV1
  benefit: LegacySchoolBenefitV1
  nextActionControl: LegacyNextActionControlV1
}

type LegacyVendorBatchV1 = Omit<VendorBatch, 'followUpDueAt'>

interface LegacyPrototypeDataV1 {
  version: 1
  orders: Record<string, LegacyOrderV1>
  vendorBatches: Record<string, LegacyVendorBatchV1>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateOrderV1(order: LegacyOrderV1): Order {
  const finalInvoiceAmount = order.het.status === 'APPROVED' ? order.finalInvoiceAmount : null
  const benefitFrozen =
    order.schoolPayment.status === 'LUNAS' ||
    order.benefit.status === 'ELIGIBLE' ||
    order.benefit.status === 'PAID'
  const benefitBase = benefitFrozen ? finalInvoiceAmount : null

  return {
    ...order,
    arkasBudgetAmount: order.finalInvoiceAmount,
    hetReviewedAmount: order.het.hetTotalAmount,
    finalInvoiceAmount,
    het: {
      status: order.het.status,
      detectedItemCount: order.het.detectedItemCount,
      autoMatchedItemCount: order.het.autoMatchedItemCount,
      approvedAt: order.het.approvedAt,
    },
    siplah: {
      accessAvailable: order.siplah.accessAvailable,
      orderPlaced: order.siplah.orderPlaced,
      orderNumber: order.siplah.orderNumber,
      suratPesananAvailable: order.siplah.suratPesananAvailable,
      suratPesananAttached: order.siplah.suratPesananAttached,
      suratPesananSentToSchool: order.siplah.suratPesananSentToSchool,
    },
    schoolPayment: {
      status: order.schoolPayment.status,
      schoolPaidAmount: order.schoolPayment.amount,
      paidAt: order.schoolPayment.paidAt,
      method: order.schoolPayment.method,
      evidenceName: order.schoolPayment.evidenceName,
      followUpDueAt: order.schoolPayment.followUpDueAt,
    },
    benefit: {
      ...order.benefit,
      baseAmount: benefitBase,
      obligationAmount:
        benefitBase === null ? null : Math.round(benefitBase * 0.1),
    },
    nextActionControl: {
      override: order.nextActionControl.override,
      // A v1 snooze applied to an entire order and cannot be mapped safely to one obligation.
      controlsByActionKey: {},
    },
  }
}

function migrateV1(state: LegacyPrototypeDataV1): PrototypeData {
  return {
    version: DEMO_STATE_VERSION,
    orders: Object.fromEntries(
      Object.entries(state.orders).map(([orderId, order]) => [orderId, migrateOrderV1(order)]),
    ),
    vendorBatches: Object.fromEntries(
      Object.entries(state.vendorBatches).map(([batchId, batch]) => [
        batchId,
        { ...batch, followUpDueAt: null },
      ]),
    ),
  }
}

export function migratePrototypeState(
  persistedState: unknown,
  persistedVersion: number,
): PrototypeData {
  if (!isRecord(persistedState)) return createCanonicalDemoData()
  if (!isRecord(persistedState.orders) || !isRecord(persistedState.vendorBatches)) {
    return createCanonicalDemoData()
  }

  if (persistedVersion === 1) {
    try {
      return migrateV1(persistedState as unknown as LegacyPrototypeDataV1)
    } catch {
      return createCanonicalDemoData()
    }
  }

  if (persistedVersion === DEMO_STATE_VERSION) {
    return {
      version: DEMO_STATE_VERSION,
      orders: persistedState.orders as Record<string, Order>,
      vendorBatches: persistedState.vendorBatches as Record<string, VendorBatch>,
    }
  }

  return createCanonicalDemoData()
}
