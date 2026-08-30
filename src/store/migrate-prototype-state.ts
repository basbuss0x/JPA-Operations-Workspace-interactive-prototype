import { createCanonicalDemoData, createCanonicalSchools, DEMO_STATE_VERSION } from '../data/demo-data'
import { normalizeSchoolName } from '../domain/school'
import { createSiplahDocuments } from '../domain/siplah'
import type {
  HetReview,
  NextActionOverride,
  Order,
  OrderItem,
  PrototypeData,
  School,
  SchoolBenefit,
  SchoolPayment,
  SiplahDocumentKind,
  SiplahProcess,
  SupplierPaymentSummary,
  VendorBatch,
} from '../domain/types'

interface LegacySiplahProcessV1 {
  accessAvailable: boolean
  orderPlaced: boolean
  orderNumber: string | null
  suratPesananAvailable: boolean
  suratPesananAttached: boolean
  suratPesananSentToSchool: boolean
  adminCompleted?: boolean
}

interface LegacySiplahDocument {
  kind: SiplahDocumentKind
  label: string
  required?: boolean
  requiredForVendorReady?: boolean
  requiredForAdminCompletion?: boolean
  sendToSchoolRequired: boolean
  available: boolean
  fileName: string | null
  verified: boolean
  sentToSchool: boolean
}

interface LegacySiplahProcessV3 {
  accessAvailable: boolean
  orderPlaced: boolean
  orderNumber: string | null
  documents: LegacySiplahDocument[]
}

type LegacyOrderItem = Omit<
  OrderItem,
  'matchConfidence' | 'matchReason' | 'resolutionType'
>

interface LegacySupplierPayment {
  status?: 'UNPAID' | 'PARTIAL' | 'PAID'
  obligationAmount?: number | null
  paidAmount?: number
}

interface LegacyOrderV2 extends Omit<Order, 'items' | 'siplah' | 'supplierPayment'> {
  items: LegacyOrderItem[]
  siplah: LegacySiplahProcessV1
  supplierPayment?: LegacySupplierPayment
}

interface LegacyOrderV3 extends Omit<Order, 'items' | 'siplah' | 'supplierPayment'> {
  items: LegacyOrderItem[]
  siplah: LegacySiplahProcessV3
  supplierPayment?: LegacySupplierPayment
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

type LegacyVendorBatch = Partial<VendorBatch> & Pick<
  VendorBatch,
  'id' | 'status' | 'createdAt' | 'sentAt' | 'arrivedAt' | 'orderIds'
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function migrateItem(item: LegacyOrderItem): OrderItem {
  const resolved = item.matchStatus === 'MATCHED' || item.matchStatus === 'MANUAL_OVERRIDE'
  return {
    ...item,
    matchConfidence: item.matchStatus === 'MATCHED' ? 0.99 : null,
    matchReason: resolved
      ? 'Dimigrasikan dari data prototipe sebelumnya.'
      : 'Pengecualian dari data sebelumnya memerlukan keputusan operator.',
    resolutionType:
      item.matchStatus === 'MATCHED'
        ? 'AUTO_MATCHED'
        : item.matchStatus === 'MANUAL_OVERRIDE' ? 'MANUAL_OVERRIDE' : null,
  }
}

function migrateSupplierPayment(payment?: LegacySupplierPayment): SupplierPaymentSummary {
  const status = payment?.status === 'PARTIAL'
    ? 'PARTIAL'
    : payment?.status === 'PAID'
      ? 'PAID'
      : payment?.status === 'UNPAID'
        ? 'UNPAID'
        : 'NOT_SET'
  return {
    status,
    // Legacy versions derived this number from ARKAS/HET. Do not carry that assumption forward.
    obligationAmount: null,
    paidAmount: payment?.paidAmount ?? 0,
  }
}

function migrateSiplah(process: LegacySiplahProcessV1): SiplahProcess {
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

function migrateSiplahV3(process: LegacySiplahProcessV3): SiplahProcess {
  const definitions = createSiplahDocuments()
  const documents = definitions.map((definition) => {
    const source = process.documents.find((document) => document.kind === definition.kind)
    return source
      ? {
          ...definition,
          available: source.available,
          fileName: source.fileName,
          verified: source.verified,
          sentToSchool: source.sentToSchool,
        }
      : definition
  })
  return {
    accessAvailable: process.accessAvailable,
    orderPlaced: process.orderPlaced,
    orderNumber: process.orderNumber,
    documents,
  }
}

function normalizeCurrentOrder(order: Order): Order {
  const finalInvoiceAmount = order.siplah.orderPlaced ? order.finalInvoiceAmount : null
  const benefitFrozen =
    order.schoolPayment.status === 'LUNAS' ||
    order.benefit.status === 'ELIGIBLE' ||
    order.benefit.status === 'PAID'
  const benefitBase = benefitFrozen ? order.benefit.baseAmount ?? finalInvoiceAmount : null
  const legacyGoods = order.goods as Omit<Order['goods'], 'checkNote'> & { checkNote?: string | null }
  const legacyFulfillment = order.fulfillment as Omit<
    Order['fulfillment'],
    'trackerOrderId' | 'trackerUrl' | 'lastSyncAttemptAt' | 'syncMessage'
  > & Partial<Pick<
    Order['fulfillment'],
    'trackerOrderId' | 'trackerUrl' | 'lastSyncAttemptAt' | 'syncMessage'
  >>
  const legacyPayment = order.schoolPayment as Omit<
    SchoolPayment,
    'deductionAmount' | 'netReceivedAmount'
  > & Partial<Pick<SchoolPayment, 'deductionAmount' | 'netReceivedAmount'>>
  const legacyBenefit = order.benefit as Omit<
    SchoolBenefit,
    'recipientType' | 'accountReference' | 'schoolConfirmedAt'
  > & Partial<Pick<SchoolBenefit, 'recipientType' | 'accountReference' | 'schoolConfirmedAt'>>
  const deductionAmount = legacyPayment.deductionAmount ?? 0
  return {
    ...order,
    hetReviewedAmount: order.het.status === 'APPROVED' ? order.hetReviewedAmount : null,
    finalInvoiceAmount,
    goods: { ...legacyGoods, checkNote: legacyGoods.checkNote ?? null },
    fulfillment: {
      ...legacyFulfillment,
      trackerOrderId: legacyFulfillment.trackerOrderId ?? `KBT-${order.id.replace('ORD-', '')}`,
      trackerUrl: legacyFulfillment.trackerUrl ?? `https://kelengkapan.demo.local/orders/${order.id}`,
      lastSyncAttemptAt: legacyFulfillment.lastSyncAttemptAt ?? legacyFulfillment.lastUpdated,
      syncMessage: legacyFulfillment.syncMessage ?? null,
    },
    schoolPayment: {
      ...legacyPayment,
      deductionAmount,
      netReceivedAmount: legacyPayment.netReceivedAmount ?? legacyPayment.schoolPaidAmount - deductionAmount,
    },
    benefit: {
      ...legacyBenefit,
      baseAmount: benefitBase,
      obligationAmount:
        benefitBase === null ? null : legacyBenefit.obligationAmount ?? Math.round(benefitBase * 0.1),
      method: legacyBenefit.method === null
        ? null
        : legacyBenefit.method === 'CASH' ? 'CASH' : 'TRANSFER',
      recipientType: legacyBenefit.recipientType ?? (legacyBenefit.status === 'PAID' ? 'SCHOOL_OFFICIAL' : null),
      accountReference: legacyBenefit.accountReference ?? null,
      schoolConfirmedAt: legacyBenefit.schoolConfirmedAt ?? null,
    },
  }
}

function migrateOrderV2(order: LegacyOrderV2): Order {
  return normalizeCurrentOrder({
    ...order,
    items: order.items.map(migrateItem),
    siplah: migrateSiplah(order.siplah),
    supplierPayment: migrateSupplierPayment(order.supplierPayment),
  })
}

function migrateOrderV3(order: LegacyOrderV3): Order {
  return normalizeCurrentOrder({
    ...order,
    items: order.items.map(migrateItem),
    siplah: migrateSiplahV3(order.siplah),
    supplierPayment: migrateSupplierPayment(order.supplierPayment),
  })
}

function migrateOrderV1(order: LegacyOrderV1): Order {
  const finalInvoiceAmount = order.siplah.orderPlaced && order.het.status === 'APPROVED'
    ? order.finalInvoiceAmount
    : null
  const benefitFrozen =
    order.schoolPayment.status === 'LUNAS' ||
    order.benefit.status === 'ELIGIBLE' ||
    order.benefit.status === 'PAID'
  const benefitBase = benefitFrozen ? finalInvoiceAmount : null
  const v2Order: LegacyOrderV2 = {
    ...order,
    arkasBudgetAmount: order.finalInvoiceAmount,
    hetReviewedAmount: order.het.status === 'APPROVED' ? order.het.hetTotalAmount : null,
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
      deductionAmount: 0,
      netReceivedAmount: order.schoolPayment.amount,
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
    ...(order.supplierPayment ? { supplierPayment: order.supplierPayment } : {}),
  }
  return migrateOrderV2(v2Order)
}

function migrateVendorBatches(
  batches: Record<string, LegacyVendorBatch | VendorBatch>,
): Record<string, VendorBatch> {
  return Object.fromEntries(
    Object.entries(batches).map(([batchId, batch]) => [
      batchId,
      {
        ...batch,
        recapGeneratedAt: batch.recapGeneratedAt ?? batch.sentAt ?? null,
        recapGenerationCount: batch.recapGenerationCount ?? (batch.status === 'DRAFT' ? 0 : 1),
        confirmedAt: batch.confirmedAt ?? null,
        processingStartedAt: batch.processingStartedAt ?? null,
        followUpDueAt: batch.followUpDueAt ?? null,
        timeline: batch.timeline ?? [],
      },
    ]),
  )
}

function migrateOrders(
  orders: Record<string, LegacyOrderV1 | LegacyOrderV2 | LegacyOrderV3>,
  version: 1 | 2 | 3,
): Record<string, Order> {
  return Object.fromEntries(
    Object.entries(orders).map(([orderId, order]) => [
      orderId,
      version === 1
        ? migrateOrderV1(order as LegacyOrderV1)
        : version === 2
          ? migrateOrderV2(order as LegacyOrderV2)
          : migrateOrderV3(order as LegacyOrderV3),
    ]),
  )
}

function isPersistedSchool(value: unknown, key: string): value is School {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.city === 'string' &&
    (value.status === 'ACTIVE' || value.status === 'INACTIVE') &&
    (typeof value.id === 'string' ? value.id === key : true)
  )
}

interface SchoolIdentityMigration {
  schools: Record<string, School>
  orders: Record<string, Order>
}

function migrateSchoolIdentities(
  orders: Record<string, Order>,
  persistedSchools?: unknown,
): SchoolIdentityMigration {
  const schools = createCanonicalSchools()
  const schoolIdAliases = new Map<string, string>()
  const schoolIdsByName = new Map<string, string>()

  const rememberName = (name: string, schoolId: string) => {
    const normalizedName = normalizeSchoolName(name)
    if (normalizedName && !schoolIdsByName.has(normalizedName)) {
      schoolIdsByName.set(normalizedName, schoolId)
    }
  }

  // Canonical demo IDs win over legacy IDs when the school name is the same.
  for (const school of Object.values(schools)) {
    schoolIdAliases.set(school.id, school.id)
    rememberName(school.name, school.id)
  }

  if (isRecord(persistedSchools)) {
    for (const [schoolId, value] of Object.entries(persistedSchools).sort(([left], [right]) => left.localeCompare(right, 'id'))) {
      if (!isPersistedSchool(value, schoolId)) continue

      const existingById = schools[schoolId]
      if (existingById) {
        // An explicit persisted registry record may carry a user-maintained display name.
        // Keep its old name as an alias so legacy orders still resolve to this same ID.
        rememberName(existingById.name, schoolId)
        schools[schoolId] = { ...value, id: schoolId }
        schoolIdAliases.set(schoolId, schoolId)
        rememberName(value.name, schoolId)
        continue
      }

      const canonicalId = schoolIdsByName.get(normalizeSchoolName(value.name))
      if (canonicalId) {
        schoolIdAliases.set(schoolId, canonicalId)
        continue
      }

      schools[schoolId] = { ...value, id: schoolId }
      schoolIdAliases.set(schoolId, schoolId)
      rememberName(value.name, schoolId)
    }
  }

  const migratedOrders: Record<string, Order> = { ...orders }
  // Sorting makes the chosen ID deterministic when old data has only duplicate unknown IDs.
  for (const order of Object.values(orders).sort((left, right) => left.id.localeCompare(right.id, 'id'))) {
    const schoolIdByLegacyId = schoolIdAliases.get(order.schoolId)
    const schoolIdByName = schoolIdsByName.get(normalizeSchoolName(order.schoolName))
    let canonicalId = schoolIdByLegacyId ?? schoolIdByName

    if (!canonicalId) {
      // Historical state did not have an eligibility source. Preserve unknown schools as active
      // rather than inferring inactivity from an order's CLOSED lifecycle stage.
      canonicalId = order.schoolId
      schools[canonicalId] = {
        id: canonicalId,
        name: order.schoolName,
        city: 'Lokasi belum diisi',
        status: 'ACTIVE',
      }
      schoolIdAliases.set(canonicalId, canonicalId)
      rememberName(order.schoolName, canonicalId)
    }

    const school = schools[canonicalId]
    if (!school) throw new Error(`Registry sekolah ${canonicalId} tidak dapat dipulihkan.`)
    migratedOrders[order.id] = {
      ...order,
      schoolId: canonicalId,
      schoolName: school.name,
    }
  }

  return { schools, orders: migratedOrders }
}

export function migratePrototypeState(
  persistedState: unknown,
  persistedVersion: number,
): PrototypeData {
  if (!isRecord(persistedState)) return createCanonicalDemoData()
  if (!isRecord(persistedState.orders) || !isRecord(persistedState.vendorBatches)) {
    return createCanonicalDemoData()
  }

  if (
    persistedVersion === 1 ||
    persistedVersion === 2 ||
    persistedVersion === 3 ||
    persistedVersion === 4 ||
    persistedVersion === 5 ||
    persistedVersion === 6 ||
    persistedVersion === 7
  ) {
    try {
      const orders = persistedVersion === 1 || persistedVersion === 2 || persistedVersion === 3
        ? migrateOrders(
            persistedState.orders as Record<string, LegacyOrderV1 | LegacyOrderV2 | LegacyOrderV3>,
            persistedVersion,
          )
        : Object.fromEntries(
            Object.entries(persistedState.orders as Record<string, Order>).map(([orderId, order]) => [
              orderId,
              normalizeCurrentOrder(order),
            ]),
          )
      return {
        version: DEMO_STATE_VERSION,
        ...migrateSchoolIdentities(
          orders,
          persistedState.schools,
        ),
        vendorBatches: migrateVendorBatches(
          persistedState.vendorBatches as Record<string, LegacyVendorBatch | VendorBatch>,
        ),
      }
    } catch {
      return createCanonicalDemoData()
    }
  }

  if (persistedVersion === DEMO_STATE_VERSION && isRecord(persistedState.schools)) {
    return {
      version: DEMO_STATE_VERSION,
      ...migrateSchoolIdentities(
        persistedState.orders as Record<string, Order>,
        persistedState.schools,
      ),
      vendorBatches: persistedState.vendorBatches as Record<string, VendorBatch>,
    }
  }

  return createCanonicalDemoData()
}
