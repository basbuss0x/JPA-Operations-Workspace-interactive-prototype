export type LifecycleStage =
  | 'INTAKE'
  | 'HET_REVIEW'
  | 'SIPLAH'
  | 'VENDOR'
  | 'GOODS_ARRIVED'
  | 'DISTRIBUTION'
  | 'COMPLETION'
  | 'CLOSED'

export type HetReviewStatus = 'NOT_STARTED' | 'EXTRACTED' | 'NEEDS_REVIEW' | 'APPROVED'
export type HetItemStatus =
  | 'MATCHED'
  | 'PRICE_MISMATCH'
  | 'AMBIGUOUS_MATCH'
  | 'NO_MATCH'
  | 'MANUAL_OVERRIDE'

export type VendorBatchStatus =
  | 'DRAFT'
  | 'RECAP_GENERATED'
  | 'SENT_TO_VENDOR'
  | 'VENDOR_CONFIRMED'
  | 'PROCESSING'
  | 'PARTIALLY_ARRIVED'
  | 'ARRIVED'

export type SchoolStatus = 'ACTIVE' | 'INACTIVE'
export type SchoolPaymentStatus = 'UNPAID' | 'LUNAS'
export type BenefitStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'PAID'
export type SupplierPaymentStatus = 'NOT_SET' | 'UNPAID' | 'PARTIAL' | 'PAID'
export type SyncStatus = 'OK' | 'STALE' | 'ERROR'
export type BenefitPaymentMethod = 'CASH' | 'TRANSFER'
export type BenefitRecipientType = 'SCHOOL_OFFICIAL' | 'INDIVIDUAL'

export interface School {
  id: string
  name: string
  city: string
  status: SchoolStatus
}

export type HetResolutionType =
  | 'AUTO_MATCHED'
  | 'ACCEPTED_SUGGESTION'
  | 'CHOSEN_PRODUCT'
  | 'MANUAL_OVERRIDE'

export interface OrderItem {
  id: string
  productCode: string | null
  readonly arkasTitle: string
  masterProductTitle: string | null
  readonly quantity: number
  readonly arkasUnitPrice: number
  hetUnitPrice: number | null
  matchStatus: HetItemStatus
  matchConfidence: number | null
  matchReason: string
  resolutionType: HetResolutionType | null
  resolutionNote?: string
}

export interface ExtractedArkasLine {
  readonly id: string
  readonly arkasTitle: string
  readonly quantity: number
  readonly arkasUnitPrice: number
  readonly productCodeCandidate: string | null
}

export interface ArkasExtractionResult {
  fixtureId: string
  activityReference: string
  sourceLabel: string
  lines: ExtractedArkasLine[]
}

export interface ProductMasterItem {
  code: string
  title: string
  hetUnitPrice: number
  aliases: string[]
}

export interface ArkasDocument {
  reference: string
  sourceType: 'PDF' | 'PHOTO' | 'SCAN' | 'MANUAL'
  fileName: string
  uploadedAt: string
  extractedAt: string | null
}

export interface HetReview {
  status: HetReviewStatus
  detectedItemCount: number
  autoMatchedItemCount: number
  approvedAt: string | null
}

export type SiplahDocumentKind =
  | 'SURAT_PESANAN'
  | 'INVOICE'
  | 'KWITANSI'
  | 'BAST'
  | 'SIPLAH_PDF'

export interface SiplahDocument {
  kind: SiplahDocumentKind
  label: string
  requiredForVendorReady: boolean
  requiredForAdminCompletion: boolean
  sendToSchoolRequired: boolean
  available: boolean
  fileName: string | null
  verified: boolean
  sentToSchool: boolean
}

export interface SiplahProcess {
  accessAvailable: boolean
  orderPlaced: boolean
  orderNumber: string | null
  documents: SiplahDocument[]
}

export interface GoodsState {
  arrivedAt: string | null
  arrivalType: 'NONE' | 'PARTIAL' | 'FULL'
  preDeliveryCheckCompleted: boolean
  checkedAt: string | null
  checkNote: string | null
  acceptedBySchoolAt: string | null
}

export interface FulfillmentSummary {
  trackerOrderId: string
  trackerUrl: string
  orderedQty: number
  deliveredQty: number
  remainingQty: number
  problemCount: number
  progressPercent: number
  lastUpdated: string | null
  lastSyncAttemptAt: string | null
  syncStatus: SyncStatus
  syncMessage: string | null
}

export type FulfillmentRefreshResult =
  | {
      status: 'OK'
      deliveredQty: number
      problemCount: number
    }
  | {
      status: 'STALE' | 'ERROR'
      message: string
    }

export interface SchoolPayment {
  status: SchoolPaymentStatus
  schoolPaidAmount: number
  deductionAmount: number
  netReceivedAmount: number
  paidAt: string | null
  method: string | null
  evidenceName: string | null
  followUpDueAt: string | null
}

export interface SchoolBenefit {
  status: BenefitStatus
  baseAmount: number | null
  obligationAmount: number | null
  eligibleAt: string | null
  paidAt: string | null
  method: BenefitPaymentMethod | null
  recipientType: BenefitRecipientType | null
  recipient: string | null
  accountReference: string | null
  proofName: string | null
  schoolConfirmedAt: string | null
}

export interface SupplierPaymentSummary {
  status: SupplierPaymentStatus
  obligationAmount: number | null
  paidAmount: number
}

export interface NextActionOverride {
  title: string
  reason: string
  dueAt: string | null
  createdAt: string
}

export interface ActionControl {
  snoozedUntil: string | null
}

export interface NextActionControl {
  override: NextActionOverride | null
  controlsByActionKey: Partial<Record<NextActionKind, ActionControl>>
}

export interface TimelineEvent {
  id: string
  occurredAt: string
  type: 'SYSTEM' | 'NOTE'
  title: string
  detail: string
}

export interface Order {
  id: string
  schoolId: string
  schoolName: string
  stage: LifecycleStage
  createdAt: string
  updatedAt: string
  readonly arkasBudgetAmount: number
  hetReviewedAmount: number | null
  finalInvoiceAmount: number | null
  arkas: ArkasDocument
  items: OrderItem[]
  het: HetReview
  siplah: SiplahProcess
  vendorBatchId: string | null
  goods: GoodsState
  fulfillment: FulfillmentSummary
  schoolPayment: SchoolPayment
  benefit: SchoolBenefit
  supplierPayment: SupplierPaymentSummary
  nextActionControl: NextActionControl
  timeline: TimelineEvent[]
}

export interface VendorBatchTimelineEvent {
  id: string
  occurredAt: string
  title: string
  detail: string
}

export interface VendorBatch {
  id: string
  status: VendorBatchStatus
  createdAt: string
  recapGeneratedAt: string | null
  recapGenerationCount: number
  sentAt: string | null
  confirmedAt: string | null
  processingStartedAt: string | null
  arrivedAt: string | null
  followUpDueAt: string | null
  orderIds: string[]
  timeline: VendorBatchTimelineEvent[]
}

export interface PrototypeData {
  version: number
  schools: Record<string, School>
  orders: Record<string, Order>
  vendorBatches: Record<string, VendorBatch>
}

export type NextActionKind =
  | 'REVIEW_HET'
  | 'COMPLETE_SIPLAH'
  | 'ADD_TO_VENDOR_BATCH'
  | 'SCHEDULE_VENDOR_FOLLOW_UP'
  | 'FOLLOW_UP_VENDOR'
  | 'SCHEDULE_PAYMENT_FOLLOW_UP'
  | 'CHECK_GOODS'
  | 'CONTINUE_FULFILLMENT'
  | 'FOLLOW_UP_PAYMENT'
  | 'PAY_BENEFIT'
  | 'CLOSE_ORDER'
  | 'MANUAL'

export function isActionSnoozable(kind: NextActionKind): boolean {
  return kind !== 'SCHEDULE_PAYMENT_FOLLOW_UP' && kind !== 'SCHEDULE_VENDOR_FOLLOW_UP'
}

export interface NextAction {
  id: string
  kind: NextActionKind
  orderId: string
  title: string
  reason: string
  href: string
  ctaLabel: string
  priority: number
  dueAt: string | null
  snoozedUntil: string | null
  snoozable: boolean
  availability: 'ACTIVE' | 'SNOOZED'
  source: 'SYSTEM' | 'MANUAL'
}

export interface ActionDerivationContext {
  vendorBatch: VendorBatch | null
}

export interface GoodsArrivalAllocation {
  orderId: string
  arrivalType: 'PARTIAL' | 'FULL'
}

export interface SchoolPaymentInput {
  schoolPaidAmount: number
  deductionAmount: number
  netReceivedAmount?: number
  method: string
  evidenceName: string
}

export interface BenefitPaymentInput {
  amount: number
  method: BenefitPaymentMethod
  recipientType: BenefitRecipientType
  recipient: string
  accountReference: string
  proofName: string
}

export interface WorkQueueItem extends NextAction {
  schoolName: string
  orderIds: string[]
  context: string
}

export interface AggregatedVendorItem {
  productCode: string
  title: string
  totalQuantity: number
  schools: Array<{
    orderId: string
    schoolName: string
    quantity: number
  }>
}

export interface VendorSchoolBreakdown {
  orderId: string
  schoolName: string
  siplahOrderNumber: string
  items: Array<{
    productCode: string
    title: string
    quantity: number
  }>
}

export interface VendorRecap {
  aggregatedItems: AggregatedVendorItem[]
  schoolBreakdown: VendorSchoolBreakdown[]
  schoolCount: number
  distinctProductCount: number
  totalQuantity: number
}

export const lifecycleLabels: Record<LifecycleStage, string> = {
  INTAKE: 'Intake',
  HET_REVIEW: 'Review HET',
  SIPLAH: 'SIPLah',
  VENDOR: 'Vendor',
  GOODS_ARRIVED: 'Barang tiba',
  DISTRIBUTION: 'Distribusi',
  COMPLETION: 'Penyelesaian',
  CLOSED: 'Selesai',
}
