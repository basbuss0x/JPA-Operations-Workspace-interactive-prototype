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

export type SchoolPaymentStatus = 'UNPAID' | 'LUNAS'
export type BenefitStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'PAID'
export type SupplierPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'
export type SyncStatus = 'OK' | 'STALE' | 'ERROR'

export interface School {
  id: string
  name: string
  city: string
}

export interface OrderItem {
  id: string
  productCode: string
  arkasTitle: string
  masterProductTitle: string | null
  quantity: number
  arkasUnitPrice: number
  hetUnitPrice: number | null
  matchStatus: HetItemStatus
  resolutionNote?: string
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
  hetTotalAmount: number
  approvedAt: string | null
}

export interface SiplahProcess {
  accessAvailable: boolean
  orderPlaced: boolean
  orderNumber: string | null
  suratPesananAvailable: boolean
  suratPesananAttached: boolean
  suratPesananSentToSchool: boolean
  adminCompleted: boolean
}

export interface GoodsState {
  arrivedAt: string | null
  arrivalType: 'NONE' | 'PARTIAL' | 'FULL'
  preDeliveryCheckCompleted: boolean
  checkedAt: string | null
  acceptedBySchoolAt: string | null
}

export interface FulfillmentSummary {
  orderedQty: number
  deliveredQty: number
  remainingQty: number
  problemCount: number
  progressPercent: number
  lastUpdated: string | null
  syncStatus: SyncStatus
}

export interface SchoolPayment {
  status: SchoolPaymentStatus
  amount: number
  paidAt: string | null
  method: string | null
  evidenceName: string | null
  followUpDueAt: string | null
}

export interface SchoolBenefit {
  status: BenefitStatus
  eligibleAt: string | null
  paidAt: string | null
  method: string | null
  recipient: string | null
  proofName: string | null
}

export interface SupplierPaymentSummary {
  status: SupplierPaymentStatus
  obligationAmount: number
  paidAmount: number
}

export interface NextActionOverride {
  title: string
  reason: string
  dueAt: string | null
  createdAt: string
}

export interface NextActionControl {
  override: NextActionOverride | null
  snoozedUntil: string | null
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
  finalInvoiceAmount: number
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

export interface VendorBatch {
  id: string
  status: VendorBatchStatus
  createdAt: string
  sentAt: string | null
  arrivedAt: string | null
  orderIds: string[]
}

export interface PrototypeData {
  version: number
  orders: Record<string, Order>
  vendorBatches: Record<string, VendorBatch>
}

export type NextActionKind =
  | 'REVIEW_HET'
  | 'COMPLETE_SIPLAH'
  | 'ADD_TO_VENDOR_BATCH'
  | 'FOLLOW_UP_VENDOR'
  | 'CHECK_GOODS'
  | 'CONTINUE_FULFILLMENT'
  | 'FOLLOW_UP_PAYMENT'
  | 'PAY_BENEFIT'
  | 'CLOSE_ORDER'
  | 'MANUAL'

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
  source: 'SYSTEM' | 'MANUAL'
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
