import { createCanonicalDemoData, DEMO_STATE_VERSION } from '../data/demo-data'
import { createSiplahDocuments } from '../domain/siplah'
import type {
  HetReview,
  NextActionOverride,
  Order,
  OrderItem,
  PrototypeData,
  SchoolBenefit,
  SchoolPayment,
  SiplahProcess,
  VendorBatch,
} from '../domain/types'

interface LegacySiplahProcess {
  accessAvailable: boolean
  orderPlaced: boolean
  orderNumber: string | null
  suratPesananAvailable: boolean
  suratPesananAttached: boolean
  suratPesananSentToSchool: boolean
  adminCompleted?: boolean
}

type LegacyOrderItem = Omit<
  OrderItem,
  'matchConfidence' | 'matchReason' | 'resolutionType'
>

interface LegacyOrderV2 extends Omit<Order, 'items' | 'siplah'> {
  items: LegacyOrderItem[]
  siplah: LegacySiplahProcess
}

interface LegacyHetReviewV1 extends HetReview {
  hetTotalAmount: number
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
  LegacyOrderV2,
  | 'arkasBudgetAmount'
  | 'hetReviewedAmount'
  | 'finalInvoiceAmount'
  | 'het'
  | 'schoolPayment'
  | 'benefit'
  | 'nextActionControl'
> {
  finalInvoiceAmount: number
  het: LegacyHetReviewV1
  schoolPayment: LegacySchoolPaymentV1
  benefit: LegacySchoolBenefitV1
  nextActionControl: LegacyNextActionControlV1
}

type LegacyVendorBatchV1 = Omit<VendorBatch, 'followUpDueAt'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateItem(item: LegacyOrderItem): OrderItem {
  const resolved = item.matchStatus === 'MATCHED' || item.matchStatus === 'MANUAL_OVERRIDE'
  return {
    ...item,
    matchConfidence: item.matchStatus === 'MATCHED' ? 0.99 : null,
    matchReason: resolved
      ? 'Dimigrasikan dari state prototype sebelumnya.'
      : 'Exception canonical dari state prototype sebelumnya.',
    resolutionType:
      item.matchStatus === 'MATCHED'
        ? 'AUTO_MATCHED'
        : item.matchStatus === 'MANUAL_OVERRIDE' ? 'MANUAL_OVERRIDE' : null,
  }
}

function migrateSiplah(process: LegacySiplahProcess): SiplahProcess {
  const previouslyComplete =
    process.orderPlaced &&
    Boolean(process.orderNumber) &&
    process.suratPesananAvailable &&
    process.suratPesananAttached &&
    process.suratPesananSentToSchool
  const documents = createSiplahDocuments(previouslyComplete)
  if (!previouslyComplete) {
    const suratPesanan = documents.find((document) => document.kind === 'SURAT_PESANAN')
    if (suratPesanan) {
      suratPesanan.available = process.suratPesananAvailable
      suratPesanan.fileName = process.suratPesananAttached ? 'SURAT_PESANAN-migrated.pdf' : null
      suratPesanan.verified = process.suratPesananAttached
      suratPesanan.sentToSchool = process.suratPesananSentToSchool
    }
  }
  return {
    accessAvailable: process.accessAvailable,
    orderPlaced: process.orderPlaced,
    orderNumber: process.orderNumber,
    documents,
  }
}

function migrateOrderV2(order: LegacyOrderV2): Order {
  return {
    ...order,
    items: order.items.map(migrateItem),
    siplah: migrateSiplah(order.siplah),
  }
}

function migrateOrderV1(order: LegacyOrderV1): Order {
  const finalInvoiceAmount = order.het.status === 'APPROVED' ? order.finalInvoiceAmount : null
  const benefitFrozen =
    order.schoolPayment.status === 'LUNAS' ||
    order.benefit.status === 'ELIGIBLE' ||
    order.benefit.status === 'PAID'
  const benefitBase = benefitFrozen ? finalInvoiceAmount : null
  const v2Order: LegacyOrderV2 = {
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
      obligationAmount: benefitBase === null ? null : Math.round(benefitBase * 0.1),
    },
    nextActionControl: {
      override: order.nextActionControl.override,
      // An order-level v1 snooze cannot be mapped safely to one action obligation.
      controlsByActionKey: {},
    },
  }
  return migrateOrderV2(v2Order)
}

function migrateVendorBatches(
  batches: Record<string, LegacyVendorBatchV1 | VendorBatch>,
): Record<string, VendorBatch> {
  return Object.fromEntries(
    Object.entries(batches).map(([batchId, batch]) => [
      batchId,
      { ...batch, followUpDueAt: 'followUpDueAt' in batch ? batch.followUpDueAt : null },
    ]),
  )
}

function migrateOrders(
  orders: Record<string, LegacyOrderV1 | LegacyOrderV2>,
  version: 1 | 2,
): Record<string, Order> {
  return Object.fromEntries(
    Object.entries(orders).map(([orderId, order]) => [
      orderId,
      version === 1
        ? migrateOrderV1(order as LegacyOrderV1)
        : migrateOrderV2(order as LegacyOrderV2),
    ]),
  )
}

export function migratePrototypeState(
  persistedState: unknown,
  persistedVersion: number,
): PrototypeData {
  if (!isRecord(persistedState)) return createCanonicalDemoData()
  if (!isRecord(persistedState.orders) || !isRecord(persistedState.vendorBatches)) {
    return createCanonicalDemoData()
  }

  if (persistedVersion === 1 || persistedVersion === 2) {
    try {
      return {
        version: DEMO_STATE_VERSION,
        orders: migrateOrders(
          persistedState.orders as Record<string, LegacyOrderV1 | LegacyOrderV2>,
          persistedVersion,
        ),
        vendorBatches: migrateVendorBatches(
          persistedState.vendorBatches as Record<string, LegacyVendorBatchV1 | VendorBatch>,
        ),
      }
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
