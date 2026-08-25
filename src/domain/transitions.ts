import { calculateArkasBudgetAmount } from './intake'
import { getHetExceptionCount, isCompletionReady } from './order-state'
import { calculateBenefitAmount, isVendorBatchEligible } from './selectors'
import { createSiplahDocuments, getSiplahDocument } from './siplah'
import type {
  ArkasExtractionResult,
  GoodsArrivalAllocation,
  NextActionKind,
  NextActionOverride,
  Order,
  ProductMasterItem,
  PrototypeData,
  SiplahDocumentKind,
  TimelineEvent,
  VendorBatchStatus,
} from './types'

function timestamp(now?: Date): string {
  return (now ?? new Date()).toISOString()
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
      acceptedBySchoolAt: null,
    },
    fulfillment: {
      orderedQty,
      deliveredQty: 0,
      remainingQty: orderedQty,
      problemCount: 0,
      progressPercent: 0,
      lastUpdated: null,
      syncStatus: 'OK',
    },
    schoolPayment: {
      status: 'UNPAID',
      schoolPaidAmount: 0,
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
      recipient: null,
      proofName: null,
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

function getResolvableHetItem(order: Order, itemId: string) {
  const target = order.items.find((item) => item.id === itemId)
  if (!target || !['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(target.matchStatus)) {
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
  const target = getResolvableHetItem(order, itemId)
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
    'Product Master dipilih',
    `${target.arkasTitle} dipetakan ke ${product.code}.`,
    now,
  )
}

export function manualOverrideHetItem(
  order: Order,
  itemId: string,
  input: { reviewedUnitPrice: number; reason: string },
  now?: Date,
): Order {
  const target = getResolvableHetItem(order, itemId)
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
    'HET manual override',
    `${target.arkasTitle}: ${input.reason.trim()}`,
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

export function createVendorBatch(
  data: PrototypeData,
  orderIds: string[],
  batchId: string,
  now?: Date,
): PrototypeData {
  if (orderIds.length === 0) throw new Error('Pilih minimal satu order.')
  if (data.vendorBatches[batchId]) throw new Error('Vendor batch ID sudah digunakan.')
  const orders = orderIds.map((id) => data.orders[id])
  if (orders.some((order) => !order || !isVendorBatchEligible(order))) {
    throw new Error('Semua order harus eligible untuk Vendor Batch.')
  }
  const createdAt = timestamp(now)
  const nextOrders = { ...data.orders }
  for (const order of orders) {
    if (!order) continue
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
    vendorBatches: {
      ...data.vendorBatches,
      [batchId]: {
        id: batchId,
        status: 'DRAFT',
        createdAt,
        sentAt: null,
        arrivedAt: null,
        followUpDueAt: null,
        orderIds,
      },
    },
  }
}

const allowedBatchTransitions: Record<VendorBatchStatus, VendorBatchStatus[]> = {
  DRAFT: ['RECAP_GENERATED'],
  RECAP_GENERATED: ['SENT_TO_VENDOR'],
  SENT_TO_VENDOR: ['VENDOR_CONFIRMED'],
  VENDOR_CONFIRMED: ['PROCESSING'],
  PROCESSING: ['PARTIALLY_ARRIVED', 'ARRIVED'],
  PARTIALLY_ARRIVED: ['ARRIVED'],
  ARRIVED: [],
}

export function transitionVendorBatch(
  data: PrototypeData,
  batchId: string,
  status: VendorBatchStatus,
  now?: Date,
): PrototypeData {
  const batch = data.vendorBatches[batchId]
  if (!batch) throw new Error('Vendor batch tidak ditemukan.')
  if (!allowedBatchTransitions[batch.status].includes(status)) {
    throw new Error(`Transisi ${batch.status} → ${status} tidak diizinkan.`)
  }
  const occurredAt = timestamp(now)
  return {
    ...data,
    vendorBatches: {
      ...data.vendorBatches,
      [batchId]: {
        ...batch,
        status,
        sentAt: status === 'SENT_TO_VENDOR' ? occurredAt : batch.sentAt,
        arrivedAt: status === 'ARRIVED' ? occurredAt : batch.arrivedAt,
      },
    },
  }
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
      },
    },
  }
}

export function recordSchoolPayment(
  order: Order,
  input: { amount: number; method: string; evidenceName: string },
  now?: Date,
): Order {
  if (order.schoolPayment.status === 'LUNAS') {
    throw new Error('Pembayaran sekolah sudah dikonfirmasi LUNAS.')
  }
  if (order.finalInvoiceAmount === null || input.amount !== order.finalInvoiceAmount) {
    throw new Error('Pembayaran penuh harus sesuai finalInvoiceAmount yang sudah ditetapkan.')
  }
  const paidAt = timestamp(now)
  const benefitObligation = Math.round(order.finalInvoiceAmount * 0.1)
  const next: Order = {
    ...order,
    schoolPayment: {
      status: 'LUNAS',
      schoolPaidAmount: input.amount,
      paidAt,
      method: input.method,
      evidenceName: input.evidenceName,
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
  return withEvent(
    next,
    'Pembayaran sekolah LUNAS',
    `Pembayaran penuh tercatat. Benefit ${benefitObligation.toLocaleString('id-ID')} dibekukan dan kini eligible.`,
    now,
  )
}

export function recordBenefitPayment(
  order: Order,
  input: { amount: number; method: string; recipient: string; proofName: string },
  now?: Date,
): Order {
  if (order.schoolPayment.status !== 'LUNAS' || order.benefit.status !== 'ELIGIBLE') {
    throw new Error('Benefit hanya dapat dibayar setelah pembayaran sekolah LUNAS.')
  }
  const obligationAmount = calculateBenefitAmount(order)
  if (obligationAmount === null || input.amount !== obligationAmount) {
    throw new Error('Nominal benefit harus sesuai kewajiban yang dibekukan saat LUNAS.')
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
      recipient: input.recipient,
      proofName: input.proofName,
    },
  }
  return withEvent(next, 'Benefit dibayar', `Benefit dibayar kepada ${input.recipient}.`, now)
}

export function closeOrder(order: Order, now?: Date): Order {
  if (!isCompletionReady(order)) throw new Error('Order belum memenuhi syarat penutupan.')
  return withEvent({ ...order, stage: 'CLOSED' }, 'Order ditutup', 'Semua checkpoint sisi JPA selesai.', now)
}

export function setNextActionOverride(
  order: Order,
  override: Omit<NextActionOverride, 'createdAt'> | null,
  now?: Date,
): Order {
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
        detail: note,
      },
      ...order.timeline,
    ],
  }
}
