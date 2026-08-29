import { calculateArkasBudgetAmount } from './intake'
import {
  deriveActiveLifecycleStage,
  getHetExceptionCount,
  isCompletionReady,
} from './order-state'
import { buildVendorRecap, calculateBenefitAmount, isVendorBatchEligible } from './selectors'
import { createSiplahDocuments, getSiplahDocument } from './siplah'
import {
  reminderTimestampToCalendarDate,
  validateReminderTimestamp,
} from '../utils/reminder-date'
import { isActionSnoozable } from './types'
import type {
  ArkasExtractionResult,
  BenefitPaymentInput,
  FulfillmentRefreshResult,
  GoodsArrivalAllocation,
  NextActionKind,
  NextActionOverride,
  Order,
  ProductMasterItem,
  PrototypeData,
  SchoolPaymentInput,
  SiplahDocumentKind,
  TimelineEvent,
  VendorBatch,
  VendorBatchStatus,
  VendorBatchTimelineEvent,
} from './types'

function timestamp(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

function sameReminderDate(left: string | null, right: string | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  const leftDate = reminderTimestampToCalendarDate(left)
  const rightDate = reminderTimestampToCalendarDate(right)
  return leftDate !== '' && leftDate === rightDate
}

function timelineEvent(order: Order, title: string, detail: string, now?: Date): TimelineEvent {
  const occurredAt = timestamp(now)
  return {
    id: `${order.id}-${occurredAt}-${order.timeline.length}`,
    occurredAt,
    type: 'SYSTEM',
    title,
    detail,
  }
}

function withEvent(order: Order, title: string, detail: string, now?: Date): Order {
  const occurredAt = timestamp(now)
  return {
    ...order,
    updatedAt: occurredAt,
    timeline: [timelineEvent(order, title, detail, now), ...order.timeline],
  }
}

export interface CreateOrderFromExtractionInput {
  id: string
  schoolId: string
  schoolName: string
  sourceType: Order['arkas']['sourceType']
  fileName: string
  extraction: ArkasExtractionResult
  matchedItems: Order['items']
}

export function createOrderFromExtraction(
  input: CreateOrderFromExtractionInput,
  now?: Date,
): Order {
  const createdAt = timestamp(now)
  const arkasBudgetAmount = calculateArkasBudgetAmount(input.extraction.lines)
  const orderedQty = input.matchedItems.reduce((total, item) => total + item.quantity, 0)
  const exceptionCount = input.matchedItems.filter((item) =>
    ['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(item.matchStatus),
  ).length
  return {
    id: input.id,
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    stage: 'HET_REVIEW',
    createdAt,
    updatedAt: createdAt,
    arkasBudgetAmount,
    hetReviewedAmount: null,
    finalInvoiceAmount: null,
    arkas: {
      reference: input.extraction.activityReference,
      sourceType: input.sourceType,
      fileName: input.fileName,
      uploadedAt: createdAt,
      extractedAt: createdAt,
    },
    items: input.matchedItems.map((item) => ({ ...item })),
    het: {
      status: exceptionCount > 0 ? 'NEEDS_REVIEW' : 'EXTRACTED',
      detectedItemCount: input.matchedItems.length,
      autoMatchedItemCount: input.matchedItems.length - exceptionCount,
      approvedAt: null,
    },
    siplah: {
      accessAvailable: false,
      orderPlaced: false,
      orderNumber: null,
      documents: createSiplahDocuments(),
    },
    vendorBatchId: null,
    goods: {
      arrivedAt: null,
      arrivalType: 'NONE',
      preDeliveryCheckCompleted: false,
      checkedAt: null,
      checkNote: null,
      acceptedBySchoolAt: null,
    },
    fulfillment: {
      trackerOrderId: `KBT-${input.id.replace('ORD-', '')}`,
      trackerUrl: `https://kelengkapan.demo.local/orders/${input.id}`,
      orderedQty,
      deliveredQty: 0,
      remainingQty: orderedQty,
      problemCount: 0,
      progressPercent: 0,
      lastUpdated: null,
      lastSyncAttemptAt: null,
      syncStatus: 'OK',
      syncMessage: null,
    },
    schoolPayment: {
      status: 'UNPAID',
      schoolPaidAmount: 0,
      deductionAmount: 0,
      netReceivedAmount: 0,
      paidAt: null,
      method: null,
      evidenceName: null,
      followUpDueAt: null,
    },
    benefit: {
      status: 'NOT_ELIGIBLE',
      baseAmount: null,
      obligationAmount: null,
      eligibleAt: null,
      paidAt: null,
      method: null,
      recipientType: null,
      recipient: null,
      accountReference: null,
      proofName: null,
      schoolConfirmedAt: null,
    },
    supplierPayment: {
      status: 'NOT_SET',
      obligationAmount: null,
      paidAmount: 0,
    },
    nextActionControl: {
      override: null,
      controlsByActionKey: {},
    },
    timeline: [
      {
        id: `${input.id}-matched-${createdAt}`,
        occurredAt: createdAt,
        type: 'SYSTEM',
        title: 'HET matching selesai',
        detail: `${input.matchedItems.length - exceptionCount} item cocok otomatis; ${exceptionCount} memerlukan review.`,
      },
      {
        id: `${input.id}-extracted-${createdAt}`,
        occurredAt: createdAt,
        type: 'SYSTEM',
        title: 'ARKAS diekstrak',
        detail: `${input.matchedItems.length} item terstruktur dari ${input.fileName}.`,
      },
      {
        id: `${input.id}-uploaded-${createdAt}`,
        occurredAt: createdAt,
        type: 'SYSTEM',
        title: 'ARKAS diterima',
        detail: `Sumber ${input.sourceType} dicatat tanpa mengubah nilai aslinya.`,
      },
    ],
  }
}

function assertHetReviewOpen(order: Order): void {
  if (order.stage !== 'HET_REVIEW' || order.het.status === 'APPROVED') {
    throw new Error('Item HET hanya dapat diedit saat review HET terbuka.')
  }
}

function getHetItem(order: Order, itemId: string) {
  assertHetReviewOpen(order)
  const target = order.items.find((item) => item.id === itemId)
  if (!target) throw new Error('Item HET tidak ditemukan.')
  return target
}

function getResolvableHetItem(order: Order, itemId: string) {
  const target = getHetItem(order, itemId)
  if (!['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(target.matchStatus)) {
    throw new Error('Item bukan HET exception yang dapat diselesaikan.')
  }
  return target
}

export function acceptSuggestedHetMatch(order: Order, itemId: string, now?: Date): Order {
  const target = getResolvableHetItem(order, itemId)
  if (!target.productCode || !target.masterProductTitle || target.hetUnitPrice === null) {
    throw new Error('Item tidak memiliki suggested match yang dapat diterima.')
  }
  return withEvent(
    {
      ...order,
      items: order.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              matchStatus: 'MATCHED' as const,
              resolutionType: 'ACCEPTED_SUGGESTION' as const,
              resolutionNote: 'Suggested Product Master diterima operator.',
            }
          : item,
      ),
    },
    'HET exception diselesaikan',
    `${target.arkasTitle}: suggested match diterima.`,
    now,
  )
}

export function chooseHetProduct(
  order: Order,
  itemId: string,
  product: ProductMasterItem,
  now?: Date,
): Order {
  const target = getHetItem(order, itemId)
  const isCorrection = target.matchStatus === 'MATCHED' || target.matchStatus === 'MANUAL_OVERRIDE'
  return withEvent(
    {
      ...order,
      items: order.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productCode: product.code,
              masterProductTitle: product.title,
              hetUnitPrice: product.hetUnitPrice,
              matchStatus: 'MATCHED' as const,
              matchConfidence: 1,
              matchReason: 'Product Master dipilih langsung oleh operator.',
              resolutionType: 'CHOSEN_PRODUCT' as const,
              resolutionNote: `Dipilih: ${product.code}.`,
            }
          : item,
      ),
    },
    isCorrection ? 'Pemetaan HET dikoreksi' : 'Product Master dipilih',
    isCorrection
      ? `${target.arkasTitle}: ${target.productCode ?? 'tanpa produk'} diganti ke ${product.code}.`
      : `${target.arkasTitle} dipetakan ke ${product.code}.`,
    now,
  )
}

export function manualOverrideHetItem(
  order: Order,
  itemId: string,
  input: { reviewedUnitPrice: number; reason: string },
  now?: Date,
): Order {
  const target = getHetItem(order, itemId)
  const isCorrection = target.matchStatus === 'MATCHED' || target.matchStatus === 'MANUAL_OVERRIDE'
  if (!input.reason.trim()) throw new Error('Manual override membutuhkan alasan.')
  if (!Number.isFinite(input.reviewedUnitPrice) || input.reviewedUnitPrice <= 0) {
    throw new Error('Harga review manual harus lebih dari nol.')
  }
  return withEvent(
    {
      ...order,
      items: order.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productCode: `MANUAL-${item.id.toUpperCase()}`,
              masterProductTitle: item.arkasTitle,
              hetUnitPrice: input.reviewedUnitPrice,
              matchStatus: 'MANUAL_OVERRIDE' as const,
              matchConfidence: null,
              matchReason: 'Nilai ditetapkan manual oleh operator.',
              resolutionType: 'MANUAL_OVERRIDE' as const,
              resolutionNote: input.reason.trim(),
            }
          : item,
      ),
    },
    isCorrection ? 'Harga HET dikoreksi' : 'HET manual override',
    isCorrection
      ? `${target.arkasTitle}: ${target.hetUnitPrice === null ? 'harga belum ada' : `Rp${target.hetUnitPrice.toLocaleString('id-ID')}`} menjadi Rp${input.reviewedUnitPrice.toLocaleString('id-ID')}. Alasan: ${input.reason.trim()}`
      : `${target.arkasTitle}: ${input.reason.trim()}`,
    now,
  )
}

export function calculateReviewedHetAmount(items: Order['items']): number {
  const unresolved = items.some((item) =>
    ['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(item.matchStatus),
  )
  if (unresolved || items.some((item) => item.hetUnitPrice === null)) {
    throw new Error('Reviewed HET amount belum dapat dihitung karena masih ada exception.')
  }
  return items.reduce(
    (total, item) => total + item.quantity * (item.hetUnitPrice ?? 0),
    0,
  )
}

export function resolveHetException(
  order: Order,
  itemId: string,
  note: string,
  now?: Date,
): Order {
  const target = getResolvableHetItem(order, itemId)
  return manualOverrideHetItem(
    order,
    itemId,
    { reviewedUnitPrice: target.hetUnitPrice ?? target.arkasUnitPrice, reason: note },
    now,
  )
}

export function confirmHetReview(order: Order, now?: Date): Order {
  if (getHetExceptionCount(order) > 0) {
    throw new Error('Semua HET exception harus diselesaikan sebelum approval.')
  }
  if (order.het.status === 'APPROVED') throw new Error('HET review sudah disetujui.')
  const reviewedAmount = calculateReviewedHetAmount(order.items)
  const approvedAt = timestamp(now)
  const next: Order = {
    ...order,
    stage: 'SIPLAH',
    hetReviewedAmount: reviewedAmount,
    finalInvoiceAmount: null,
    het: { ...order.het, status: 'APPROVED', approvedAt },
  }
  return withEvent(
    next,
    'HET disetujui',
    `Review HET dikonfirmasi sebesar Rp${reviewedAmount.toLocaleString('id-ID')}; nilai transaksi final akan dicatat saat order SIPLah dikonfirmasi. ARKAS sumber tetap Rp${order.arkasBudgetAmount.toLocaleString('id-ID')}.`,
    now,
  )
}

export function setSiplahAccessAvailable(
  order: Order,
  available: boolean,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  return withEvent(
    { ...order, siplah: { ...order.siplah, accessAvailable: available } },
    'Akses SIPLah diperbarui',
    available
      ? 'Akses sekolah tersedia. Username/password tidak disimpan.'
      : 'Akses sekolah ditandai belum tersedia.',
    now,
  )
}

export function setSiplahOrderPlaced(order: Order, now?: Date): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (order.het.status !== 'APPROVED') {
    throw new Error('HET harus disetujui sebelum mencatat pesanan SIPLah.')
  }
  if (!order.siplah.accessAvailable) {
    throw new Error('Akses SIPLah harus tersedia sebelum mencatat pesanan.')
  }
  return withEvent(
    {
      ...order,
      siplah: { ...order.siplah, orderPlaced: true },
    },
    'Pesanan SIPLah dibuat',
    'Pesanan ditandai sudah dibuat di JPA/TokoLadang; nominal transaksi dan nomor order masih menunggu konfirmasi operator.',
    now,
  )
}

export interface SiplahOrderRecordInput {
  orderNumber: string
  finalInvoiceAmount: number
}

export function recordSiplahOrder(
  order: Order,
  input: SiplahOrderRecordInput,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (!order.siplah.orderPlaced) {
    throw new Error('Pesanan harus ditandai dibuat sebelum mencatat nomor order.')
  }
  if (order.hetReviewedAmount === null) {
    throw new Error('Hasil review HET harus tersedia sebelum mencatat transaksi SIPLah.')
  }
  if (!input.orderNumber.trim()) throw new Error('Nomor order SIPLah wajib diisi.')
  if (!Number.isFinite(input.finalInvoiceAmount) || input.finalInvoiceAmount <= 0) {
    throw new Error('Nominal final SIPLah harus lebih dari nol.')
  }
  const orderNumber = input.orderNumber.trim()
  const finalInvoiceAmount = input.finalInvoiceAmount
  const differenceFromHet = finalInvoiceAmount - order.hetReviewedAmount
  return withEvent(
    {
      ...order,
      finalInvoiceAmount,
      siplah: { ...order.siplah, orderNumber },
    },
    'Transaksi SIPLah dikonfirmasi',
    `Nomor order ${orderNumber} dicatat dengan nominal final Rp${finalInvoiceAmount.toLocaleString('id-ID')}; reviewed HET Rp${order.hetReviewedAmount.toLocaleString('id-ID')}; selisih ${differenceFromHet >= 0 ? '+' : ''}Rp${differenceFromHet.toLocaleString('id-ID')}. ARKAS sumber Rp${order.arkasBudgetAmount.toLocaleString('id-ID')} tidak berubah.`,
    now,
  )
}

export function reopenHetReview(order: Order, reason: string, now?: Date): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (order.het.status !== 'APPROVED') {
    throw new Error('HET review hanya dapat dibuka kembali dari status APPROVED.')
  }
  if (order.siplah.orderPlaced) {
    throw new Error('HET tidak dapat dibuka kembali setelah order SIPLah dibuat; gunakan alur koreksi/pembatalan berikutnya.')
  }
  if (!reason.trim()) throw new Error('Alasan membuka kembali HET wajib diisi.')
  return withEvent(
    {
      ...order,
      stage: 'HET_REVIEW',
      hetReviewedAmount: null,
      finalInvoiceAmount: null,
      het: { ...order.het, status: 'NEEDS_REVIEW', approvedAt: null },
    },
    'Review HET dibuka kembali',
    `Alasan operator: ${reason.trim()}. Nilai ARKAS sumber tetap Rp${order.arkasBudgetAmount.toLocaleString('id-ID')}; hasil review harus dikonfirmasi ulang.`,
    now,
  )
}

export function markSiplahDocumentAvailable(
  order: Order,
  kind: SiplahDocumentKind,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (!order.siplah.orderPlaced) {
    throw new Error('Pesanan SIPLah harus dibuat sebelum dokumen tersedia.')
  }
  const target = getSiplahDocument(order.siplah.documents, kind)
  return withEvent(
    {
      ...order,
      siplah: {
        ...order.siplah,
        documents: order.siplah.documents.map((document) =>
          document.kind === kind ? { ...document, available: true } : document,
        ),
      },
    },
    'Dokumen SIPLah tersedia',
    `${target.label} tersedia dan menunggu lampiran/verifikasi.`,
    now,
  )
}

export function attachSiplahDocument(
  order: Order,
  kind: SiplahDocumentKind,
  fileName: string,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (!order.siplah.orderPlaced) {
    throw new Error('Pesanan SIPLah harus dibuat sebelum dokumen dilampirkan.')
  }
  if (!fileName.trim()) throw new Error('Nama file dokumen wajib diisi.')
  const target = getSiplahDocument(order.siplah.documents, kind)
  return withEvent(
    {
      ...order,
      siplah: {
        ...order.siplah,
        documents: order.siplah.documents.map((document) =>
          document.kind === kind
            ? {
                ...document,
                available: true,
                fileName: fileName.trim(),
                verified: false,
                sentToSchool: false,
              }
            : document,
        ),
      },
    },
    'Dokumen SIPLah dilampirkan',
    `${target.label}: ${fileName.trim()}.`,
    now,
  )
}

export function verifySiplahDocument(
  order: Order,
  kind: SiplahDocumentKind,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  const target = getSiplahDocument(order.siplah.documents, kind)
  if (!target.available || !target.fileName) {
    throw new Error(`${target.label} belum tersedia atau terlampir.`)
  }
  return withEvent(
    {
      ...order,
      siplah: {
        ...order.siplah,
        documents: order.siplah.documents.map((document) =>
          document.kind === kind ? { ...document, verified: true } : document,
        ),
      },
    },
    'Dokumen SIPLah diverifikasi',
    `${target.label} diverifikasi operator.`,
    now,
  )
}

export function sendSiplahDocumentToSchool(
  order: Order,
  kind: SiplahDocumentKind,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  const target = getSiplahDocument(order.siplah.documents, kind)
  if (!target.sendToSchoolRequired) {
    throw new Error(`${target.label} tidak memerlukan pengiriman ke sekolah.`)
  }
  if (!target.verified) throw new Error(`${target.label} harus diverifikasi sebelum dikirim.`)
  return withEvent(
    {
      ...order,
      siplah: {
        ...order.siplah,
        documents: order.siplah.documents.map((document) =>
          document.kind === kind ? { ...document, sentToSchool: true } : document,
        ),
      },
    },
    'Dokumen SIPLah dikirim',
    `${target.label} dikirim ke sekolah.`,
    now,
  )
}

function vendorBatchEvent(
  batch: Pick<VendorBatch, 'id' | 'timeline'>,
  title: string,
  detail: string,
  now?: Date,
): VendorBatchTimelineEvent {
  const occurredAt = timestamp(now)
  return {
    id: `${batch.id}-${occurredAt}-${batch.timeline.length}`,
    occurredAt,
    title,
    detail,
  }
}

function activeBatchContainingOrder(data: PrototypeData, orderId: string): VendorBatch | undefined {
  return Object.values(data.vendorBatches).find(
    (batch) => batch.status !== 'ARRIVED' && batch.orderIds.includes(orderId),
  )
}

export function createVendorBatch(
  data: PrototypeData,
  orderIds: string[],
  batchId: string,
  now?: Date,
): PrototypeData {
  const uniqueOrderIds = [...new Set(orderIds)]
  if (uniqueOrderIds.length === 0) throw new Error('Pilih minimal satu order.')
  if (uniqueOrderIds.length !== orderIds.length) throw new Error('Pilihan order memiliki duplikat.')
  if (!/^VB-\d{4}-\d{3,}$/.test(batchId)) throw new Error('Format Vendor Batch ID tidak valid.')
  if (data.vendorBatches[batchId]) throw new Error('Vendor Batch ID sudah digunakan.')

  const orders = uniqueOrderIds.map((id) => {
    const order = data.orders[id]
    if (!order) throw new Error(`Order ${id} tidak ditemukan.`)
    if (order.vendorBatchId) {
      throw new Error(`${id} sudah menjadi anggota ${order.vendorBatchId}.`)
    }
    const existingBatch = activeBatchContainingOrder(data, id)
    if (existingBatch) throw new Error(`${id} sudah menjadi anggota aktif ${existingBatch.id}.`)
    if (!isVendorBatchEligible(order)) {
      throw new Error(`${id} tidak lagi eligible untuk Vendor Batch.`)
    }
    return order
  })

  // Validate the exact same source items used by preview/export before assigning membership.
  buildVendorRecap(orders)

  const createdAt = timestamp(now)
  const batch: VendorBatch = {
    id: batchId,
    status: 'DRAFT',
    createdAt,
    recapGeneratedAt: null,
    recapGenerationCount: 0,
    sentAt: null,
    confirmedAt: null,
    processingStartedAt: null,
    arrivedAt: null,
    followUpDueAt: null,
    orderIds: uniqueOrderIds,
    timeline: [],
  }
  batch.timeline = [vendorBatchEvent(batch, 'Vendor Batch dibuat', `${orders.length} order ditambahkan dalam status DRAFT.`, now)]

  const nextOrders = { ...data.orders }
  for (const order of orders) {
    nextOrders[order.id] = withEvent(
      { ...order, stage: 'VENDOR', vendorBatchId: batchId },
      'Masuk Vendor Batch',
      `Order ditambahkan ke ${batchId} dalam status DRAFT.`,
      now,
    )
  }
  return {
    ...data,
    orders: nextOrders,
    vendorBatches: { ...data.vendorBatches, [batchId]: batch },
  }
}

const allowedBatchTransitions: Record<VendorBatchStatus, VendorBatchStatus[]> = {
  DRAFT: ['RECAP_GENERATED'],
  RECAP_GENERATED: ['SENT_TO_VENDOR'],
  SENT_TO_VENDOR: ['VENDOR_CONFIRMED'],
  VENDOR_CONFIRMED: ['PROCESSING'],
  PROCESSING: [],
  PARTIALLY_ARRIVED: [],
  ARRIVED: [],
}

const batchTransitionCopy: Record<
  Exclude<VendorBatchStatus, 'DRAFT' | 'PARTIALLY_ARRIVED' | 'ARRIVED'>,
  { title: string; detail: string }
> = {
  RECAP_GENERATED: {
    title: 'Rekap vendor dibuat',
    detail: 'Workbook dibuat dari OrderItem; batch belum dikirim ke vendor.',
  },
  SENT_TO_VENDOR: {
    title: 'Rekap dikirim ke vendor',
    detail: 'Operator menandai pengiriman recap secara eksplisit.',
  },
  VENDOR_CONFIRMED: {
    title: 'Vendor mengonfirmasi pesanan',
    detail: 'Vendor mengonfirmasi recap yang dikirim.',
  },
  PROCESSING: {
    title: 'Vendor mulai memproses',
    detail: 'Vendor sedang menyiapkan barang; follow-up hanya aktif jika reminder ditetapkan.',
  },
}

export function transitionVendorBatch(
  data: PrototypeData,
  batchId: string,
  status: VendorBatchStatus,
  now?: Date,
): PrototypeData {
  const batch = data.vendorBatches[batchId]
  if (!batch) throw new Error('Vendor Batch tidak ditemukan.')
  if (status === 'PARTIALLY_ARRIVED' || status === 'ARRIVED') {
    throw new Error('Status kedatangan hanya dapat diturunkan oleh recordGoodsArrival dari alokasi order.')
  }
  if (!allowedBatchTransitions[batch.status].includes(status)) {
    throw new Error(`Transisi ${batch.status} → ${status} tidak diizinkan.`)
  }
  const occurredAt = timestamp(now)
  const copy = status in batchTransitionCopy
    ? batchTransitionCopy[status as keyof typeof batchTransitionCopy]
    : { title: `Status menjadi ${status}`, detail: `Lifecycle ${batch.id} diperbarui.` }
  const nextBatch: VendorBatch = {
    ...batch,
    status,
    recapGeneratedAt: status === 'RECAP_GENERATED' ? occurredAt : batch.recapGeneratedAt,
    recapGenerationCount: status === 'RECAP_GENERATED'
      ? batch.recapGenerationCount + 1
      : batch.recapGenerationCount,
    sentAt: status === 'SENT_TO_VENDOR' ? occurredAt : batch.sentAt,
    confirmedAt: status === 'VENDOR_CONFIRMED' ? occurredAt : batch.confirmedAt,
    processingStartedAt: status === 'PROCESSING' ? occurredAt : batch.processingStartedAt,
    arrivedAt: batch.arrivedAt,
    timeline: [vendorBatchEvent(batch, copy.title, copy.detail, now), ...batch.timeline],
  }
  const nextOrders = { ...data.orders }
  for (const orderId of batch.orderIds) {
    const order = nextOrders[orderId]
    if (order) nextOrders[orderId] = withEvent(order, copy.title, `${batch.id}: ${copy.detail}`, now)
  }
  return {
    ...data,
    orders: nextOrders,
    vendorBatches: { ...data.vendorBatches, [batchId]: nextBatch },
  }
}

export function generateVendorRecap(data: PrototypeData, batchId: string, now?: Date): PrototypeData {
  const batch = data.vendorBatches[batchId]
  if (!batch) throw new Error('Vendor Batch tidak ditemukan.')
  const orders = batch.orderIds.map((orderId) => {
    const order = data.orders[orderId]
    if (!order) throw new Error(`Order ${orderId} tidak ditemukan.`)
    return order
  })
  buildVendorRecap(orders)
  if (batch.status === 'DRAFT') {
    return transitionVendorBatch(data, batchId, 'RECAP_GENERATED', now)
  }
  if (batch.status !== 'RECAP_GENERATED') {
    throw new Error(`Rekap tidak dapat dibuat ulang dari status ${batch.status}.`)
  }
  const generatedAt = timestamp(now)
  const nextBatch: VendorBatch = {
    ...batch,
    recapGeneratedAt: generatedAt,
    recapGenerationCount: batch.recapGenerationCount + 1,
    timeline: [
      vendorBatchEvent(batch, 'Rekap vendor dibuat ulang', 'Workbook terbaru dibuat dari OrderItem yang sama.', now),
      ...batch.timeline,
    ],
  }
  return { ...data, vendorBatches: { ...data.vendorBatches, [batchId]: nextBatch } }
}

export function setVendorFollowUpReminder(
  data: PrototypeData,
  batchId: string,
  followUpDueAt: string | null,
  now?: Date,
): PrototypeData {
  const batch = data.vendorBatches[batchId]
  if (!batch) throw new Error('Vendor Batch tidak ditemukan.')
  if (!['SENT_TO_VENDOR', 'VENDOR_CONFIRMED', 'PROCESSING', 'PARTIALLY_ARRIVED'].includes(batch.status)) {
    throw new Error(`Reminder vendor tidak relevan untuk status ${batch.status}.`)
  }
  if (followUpDueAt !== null) {
    const validationError = validateReminderTimestamp(
      followUpDueAt,
      now ?? new Date(),
      'Tanggal follow-up vendor',
    )
    if (validationError) throw new Error(validationError)
  }
  if (sameReminderDate(batch.followUpDueAt, followUpDueAt)) return data

  const title = followUpDueAt
    ? batch.followUpDueAt ? 'Reminder follow-up vendor diperbarui' : 'Reminder follow-up vendor diatur'
    : 'Reminder follow-up vendor dihapus'
  const detail = followUpDueAt
    ? `Follow-up dijadwalkan pada ${reminderTimestampToCalendarDate(followUpDueAt)}.`
    : 'Batch kembali pasif tanpa reminder vendor.'
  const nextBatch: VendorBatch = {
    ...batch,
    followUpDueAt,
    timeline: [vendorBatchEvent(batch, title, detail, now), ...batch.timeline],
  }
  return { ...data, vendorBatches: { ...data.vendorBatches, [batchId]: nextBatch } }
}

export function recordGoodsArrival(
  data: PrototypeData,
  batchId: string,
  allocations: GoodsArrivalAllocation[],
  now?: Date,
): PrototypeData {
  const batch = data.vendorBatches[batchId]
  if (!batch) throw new Error('Vendor batch tidak ditemukan.')
  if (!['PROCESSING', 'PARTIALLY_ARRIVED'].includes(batch.status)) {
    throw new Error(`Barang tidak dapat dicatat dari status batch ${batch.status}.`)
  }
  if (allocations.length === 0) throw new Error('Pilih minimal satu alokasi order.')

  const allocatedIds = new Set<string>()
  for (const allocation of allocations) {
    if (!batch.orderIds.includes(allocation.orderId)) {
      throw new Error(`${allocation.orderId} bukan anggota ${batchId}.`)
    }
    if (allocatedIds.has(allocation.orderId)) {
      throw new Error(`${allocation.orderId} memiliki alokasi duplikat.`)
    }
    const existingOrder = data.orders[allocation.orderId]
    if (!existingOrder) throw new Error(`Order ${allocation.orderId} tidak ditemukan.`)
    if (existingOrder.stage === 'CLOSED') {
      throw new Error(`Order ${allocation.orderId} CLOSED tidak dapat diubah tanpa dibuka kembali.`)
    }
    if (existingOrder.goods.arrivalType === 'FULL' && allocation.arrivalType === 'PARTIAL') {
      throw new Error(`${allocation.orderId} sudah tiba penuh dan tidak dapat diturunkan menjadi sebagian.`)
    }
    allocatedIds.add(allocation.orderId)
  }

  const arrivedAt = timestamp(now)
  const nextOrders = { ...data.orders }
  for (const allocation of allocations) {
    const order = data.orders[allocation.orderId]
    if (!order) throw new Error(`Order ${allocation.orderId} tidak ditemukan.`)
    nextOrders[allocation.orderId] = withEvent(
      {
        ...order,
        stage: 'GOODS_ARRIVED',
        goods: {
          ...order.goods,
          arrivedAt,
          arrivalType: allocation.arrivalType,
          preDeliveryCheckCompleted: false,
          checkedAt: null,
          checkNote: null,
        },
      },
      allocation.arrivalType === 'FULL' ? 'Barang tiba di JPA' : 'Sebagian barang tiba di JPA',
      `${batchId} mencatat kedatangan ${allocation.arrivalType === 'FULL' ? 'penuh' : 'sebagian'} untuk ${order.schoolName}; pemeriksaan belum dilakukan.`,
      now,
    )
  }

  const batchFullyArrived = batch.orderIds.every(
    (orderId) => nextOrders[orderId]?.goods.arrivalType === 'FULL',
  )
  return {
    ...data,
    orders: nextOrders,
    vendorBatches: {
      ...data.vendorBatches,
      [batchId]: {
        ...batch,
        status: batchFullyArrived ? 'ARRIVED' : 'PARTIALLY_ARRIVED',
        arrivedAt: batchFullyArrived ? arrivedAt : null,
        followUpDueAt: batchFullyArrived ? null : batch.followUpDueAt,
        timeline: [
          vendorBatchEvent(
            batch,
            batchFullyArrived ? 'Semua barang batch tiba' : 'Kedatangan barang dicatat',
            `${allocations.length} alokasi order dicatat; status batch ${batchFullyArrived ? 'ARRIVED' : 'PARTIALLY_ARRIVED'}.`,
            now,
          ),
          ...batch.timeline,
        ],
      },
    },
  }
}

export function completePreDeliveryCheck(
  order: Order,
  note: string,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (order.goods.arrivalType === 'NONE' || order.goods.arrivedAt === null) {
    throw new Error('Barang harus dicatat tiba melalui alokasi Vendor Batch sebelum diperiksa.')
  }
  if (order.goods.preDeliveryCheckCompleted) throw new Error('Pemeriksaan barang sudah selesai.')
  const checkedAt = timestamp(now)
  return withEvent(
    {
      ...order,
      stage: order.fulfillment.remainingQty > 0 ? 'DISTRIBUTION' : order.stage,
      goods: {
        ...order.goods,
        preDeliveryCheckCompleted: true,
        checkedAt,
        checkNote: note.trim() || null,
      },
    },
    'Pemeriksaan barang selesai',
    note.trim()
      ? `Barang siap dilanjutkan ke distribusi. Catatan: ${note.trim()}`
      : 'Barang siap dilanjutkan ke distribusi; status pengantaran sekolah tidak berubah.',
    now,
  )
}

export function refreshFulfillmentSummary(
  order: Order,
  result: FulfillmentRefreshResult,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat disinkronkan.')
  const attemptedAt = timestamp(now)
  if (result.status !== 'OK') {
    return withEvent(
      {
        ...order,
        fulfillment: {
          ...order.fulfillment,
          lastSyncAttemptAt: attemptedAt,
          syncStatus: result.status,
          syncMessage: result.message,
        },
      },
      result.status === 'ERROR' ? 'Sinkronisasi tracker gagal' : 'Ringkasan tracker masih stale',
      `${result.message} Nilai cache terakhir dipertahankan.`,
      now,
    )
  }
  const { orderedQty } = order.fulfillment
  if (!Number.isInteger(result.deliveredQty) || result.deliveredQty < 0 || result.deliveredQty > orderedQty) {
    throw new Error('Delivered quantity tracker harus berada antara 0 dan ordered quantity.')
  }
  if (!Number.isInteger(result.problemCount) || result.problemCount < 0) {
    throw new Error('Problem count tracker tidak valid.')
  }
  if (result.deliveredQty < order.fulfillment.deliveredQty) {
    const syncMessage = `Konflik snapshot tracker: delivered kumulatif masuk ${result.deliveredQty}, lebih rendah dari cache ${order.fulfillment.deliveredQty}. Cache terakhir dipertahankan.`
    return withEvent(
      {
        ...order,
        fulfillment: {
          ...order.fulfillment,
          lastSyncAttemptAt: attemptedAt,
          syncStatus: 'STALE',
          syncMessage,
        },
      },
      'Konflik snapshot tracker',
      syncMessage,
      now,
    )
  }
  const remainingQty = orderedQty - result.deliveredQty
  const progressPercent = orderedQty === 0 ? 100 : Math.round((result.deliveredQty / orderedQty) * 100)
  return withEvent(
    {
      ...order,
      stage:
        order.goods.preDeliveryCheckCompleted && ['VENDOR', 'GOODS_ARRIVED'].includes(order.stage)
          ? 'DISTRIBUTION'
          : order.stage,
      fulfillment: {
        ...order.fulfillment,
        deliveredQty: result.deliveredQty,
        remainingQty,
        problemCount: result.problemCount,
        progressPercent,
        lastUpdated: attemptedAt,
        lastSyncAttemptAt: attemptedAt,
        syncStatus: 'OK',
        syncMessage: 'Cache diperbarui dari snapshot tracker demo.',
      },
    },
    'Ringkasan fulfillment diperbarui',
    `${result.deliveredQty} dari ${orderedQty} buku sudah diterima sekolah; tersisa ${remainingQty}.`,
    now,
  )
}

export function recordSchoolAcceptance(order: Order, now?: Date): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (!order.goods.preDeliveryCheckCompleted) {
    throw new Error('Pemeriksaan barang harus selesai sebelum penerimaan sekolah.')
  }
  if (order.goods.arrivalType !== 'FULL') {
    throw new Error('Kedatangan vendor untuk order harus FULL sebelum penerimaan sekolah.')
  }
  if (
    order.fulfillment.deliveredQty !== order.fulfillment.orderedQty ||
    order.fulfillment.remainingQty !== 0 ||
    order.fulfillment.progressPercent !== 100
  ) {
    throw new Error('Penerimaan sekolah hanya dapat dicatat setelah fulfillment seluruh order 100%.')
  }
  if (order.goods.acceptedBySchoolAt) throw new Error('Penerimaan sekolah sudah dicatat.')
  const acceptedAt = timestamp(now)
  return withEvent(
    {
      ...order,
      stage: 'COMPLETION',
      goods: { ...order.goods, acceptedBySchoolAt: acceptedAt },
    },
    'Barang diterima sekolah',
    'Sekolah mengonfirmasi penerimaan seluruh order; checkpoint lain tetap independen.',
    now,
  )
}

export function setPaymentFollowUpReminder(
  order: Order,
  followUpDueAt: string | null,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (order.schoolPayment.status === 'LUNAS') {
    throw new Error('Reminder pembayaran tidak relevan setelah LUNAS.')
  }
  if (followUpDueAt !== null) {
    const validationError = validateReminderTimestamp(
      followUpDueAt,
      now ?? new Date(),
      'Tanggal follow-up pembayaran',
    )
    if (validationError) throw new Error(validationError)
  }
  if (sameReminderDate(order.schoolPayment.followUpDueAt, followUpDueAt)) return order

  const title = followUpDueAt
    ? order.schoolPayment.followUpDueAt ? 'Reminder pembayaran diperbarui' : 'Reminder pembayaran diatur'
    : 'Reminder pembayaran dihapus'
  const detail = followUpDueAt
    ? `Follow-up pembayaran dijadwalkan pada ${reminderTimestampToCalendarDate(followUpDueAt)}.`
    : 'Tidak ada reminder pembayaran aktif.'
  return withEvent(
    { ...order, schoolPayment: { ...order.schoolPayment, followUpDueAt } },
    title,
    detail,
    now,
  )
}

export function recordSchoolPayment(
  order: Order,
  input: SchoolPaymentInput,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (order.schoolPayment.status === 'LUNAS') {
    throw new Error('Pembayaran sekolah sudah dikonfirmasi LUNAS.')
  }
  if (order.finalInvoiceAmount === null || input.schoolPaidAmount !== order.finalInvoiceAmount) {
    throw new Error('Pembayaran gross harus sama dengan finalInvoiceAmount untuk konfirmasi LUNAS.')
  }
  if (!Number.isFinite(input.deductionAmount) || input.deductionAmount < 0) {
    throw new Error('Deduction amount tidak valid.')
  }
  const expectedNet = input.schoolPaidAmount - input.deductionAmount
  if (expectedNet < 0) throw new Error('Deduction amount tidak boleh melebihi pembayaran gross.')
  const netReceivedAmount = input.netReceivedAmount ?? expectedNet
  if (netReceivedAmount !== expectedNet) {
    throw new Error('Net received harus sama dengan schoolPaidAmount dikurangi deductionAmount.')
  }
  if (!input.method.trim() || !input.evidenceName.trim()) {
    throw new Error('Metode dan bukti pembayaran wajib dicatat.')
  }
  const paidAt = timestamp(now)
  const benefitObligation = Math.round(order.finalInvoiceAmount * 0.1)
  const next: Order = {
    ...order,
    schoolPayment: {
      status: 'LUNAS',
      schoolPaidAmount: input.schoolPaidAmount,
      deductionAmount: input.deductionAmount,
      netReceivedAmount,
      paidAt,
      method: input.method.trim(),
      evidenceName: input.evidenceName.trim(),
      followUpDueAt: null,
    },
    benefit:
      order.benefit.status === 'PAID'
        ? order.benefit
        : {
            ...order.benefit,
            status: 'ELIGIBLE',
            baseAmount: order.finalInvoiceAmount,
            obligationAmount: benefitObligation,
            eligibleAt: paidAt,
          },
  }
  const paid = withEvent(
    next,
    'Pembayaran sekolah LUNAS',
    `Gross Rp${input.schoolPaidAmount.toLocaleString('id-ID')}; potongan Rp${input.deductionAmount.toLocaleString('id-ID')}; net diterima Rp${netReceivedAmount.toLocaleString('id-ID')}.`,
    now,
  )
  return withEvent(
    paid,
    'Benefit menjadi eligible',
    `Kewajiban 10% dibekukan dari invoice gross menjadi Rp${benefitObligation.toLocaleString('id-ID')}.`,
    now,
  )
}

export function recordBenefitPayment(
  order: Order,
  input: BenefitPaymentInput,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (order.schoolPayment.status !== 'LUNAS' || order.benefit.status !== 'ELIGIBLE') {
    throw new Error('Benefit hanya dapat dibayar setelah pembayaran sekolah LUNAS.')
  }
  const obligationAmount = calculateBenefitAmount(order)
  if (obligationAmount === null || input.amount !== obligationAmount) {
    throw new Error('Nominal benefit harus sesuai kewajiban yang dibekukan dan dibayar penuh.')
  }
  if (!input.recipient.trim() || !input.proofName.trim()) {
    throw new Error('Penerima dan bukti benefit wajib dicatat.')
  }
  if (input.method === 'TRANSFER' && !input.accountReference.trim()) {
    throw new Error('Referensi rekening/transfer wajib untuk benefit TRANSFER.')
  }
  const paidAt = timestamp(now)
  const next: Order = {
    ...order,
    benefit: {
      status: 'PAID',
      baseAmount: order.benefit.baseAmount,
      obligationAmount,
      eligibleAt: order.benefit.eligibleAt,
      paidAt,
      method: input.method,
      recipientType: input.recipientType,
      recipient: input.recipient.trim(),
      accountReference: input.method === 'TRANSFER' ? input.accountReference.trim() : null,
      proofName: input.proofName.trim(),
      schoolConfirmedAt: null,
    },
  }
  return withEvent(
    next,
    'Benefit dibayar',
    `Benefit Rp${obligationAmount.toLocaleString('id-ID')} dibayar penuh kepada ${input.recipient.trim()} melalui ${input.method}.`,
    now,
  )
}

export function recordBenefitSchoolConfirmation(order: Order, now?: Date): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (order.benefit.status !== 'PAID') {
    throw new Error('Konfirmasi sekolah hanya dapat dicatat setelah benefit dibayar.')
  }
  if (order.benefit.schoolConfirmedAt) throw new Error('Konfirmasi sekolah sudah dicatat.')
  const confirmedAt = timestamp(now)
  return withEvent(
    { ...order, benefit: { ...order.benefit, schoolConfirmedAt: confirmedAt } },
    'Penerimaan benefit dikonfirmasi sekolah',
    'Metadata konfirmasi dicatat tanpa memengaruhi syarat penutupan order.',
    now,
  )
}

export function closeOrder(order: Order, now?: Date): Order {
  if (order.stage === 'CLOSED') return order
  if (!isCompletionReady(order)) throw new Error('Order belum memenuhi syarat penutupan.')
  return withEvent(
    { ...order, stage: 'CLOSED' },
    'Order ditutup',
    'Semua checkpoint blocking sisi JPA selesai; pembayaran supplier tidak memblokir penutupan.',
    now,
  )
}

export function reopenOrder(order: Order, reason: string, now?: Date): Order {
  if (order.stage !== 'CLOSED') throw new Error('Hanya order CLOSED yang dapat dibuka kembali.')
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Alasan membuka kembali order wajib diisi.')
  const stage = deriveActiveLifecycleStage(order)
  return withEvent(
    { ...order, stage },
    'Order dibuka kembali',
    `Order dipulihkan ke tahap ${stage}. Alasan operator: ${trimmedReason}.`,
    now,
  )
}

export function setNextActionOverride(
  order: Order,
  override: Omit<NextActionOverride, 'createdAt'> | null,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  const createdAt = timestamp(now)
  const controlsByActionKey = { ...order.nextActionControl.controlsByActionKey }
  delete controlsByActionKey.MANUAL
  return {
    ...order,
    updatedAt: createdAt,
    nextActionControl: {
      ...order.nextActionControl,
      override: override ? { ...override, createdAt } : null,
      controlsByActionKey,
    },
  }
}

export function snoozeOrderAction(
  order: Order,
  actionKind: NextActionKind,
  until: string | null,
  now?: Date,
): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (!isActionSnoozable(actionKind)) {
    throw new Error('Kewajiban Atur tindak lanjut tidak dapat di-snooze.')
  }
  const controlsByActionKey = { ...order.nextActionControl.controlsByActionKey }
  if (until === null) delete controlsByActionKey[actionKind]
  else controlsByActionKey[actionKind] = { snoozedUntil: until }
  return {
    ...order,
    updatedAt: timestamp(now),
    nextActionControl: { ...order.nextActionControl, controlsByActionKey },
  }
}

export function addTimelineNote(order: Order, note: string, now?: Date): Order {
  if (order.stage === 'CLOSED') throw new Error('Order CLOSED tidak dapat diubah.')
  if (!note.trim()) throw new Error('Catatan tidak boleh kosong.')
  const occurredAt = timestamp(now)
  return {
    ...order,
    updatedAt: occurredAt,
    timeline: [
      {
        id: `${order.id}-note-${occurredAt}`,
        occurredAt,
        type: 'NOTE',
        title: 'Catatan operator',
        detail: note.trim(),
      },
      ...order.timeline,
    ],
  }
}
