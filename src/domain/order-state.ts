import type { Order } from './types'

const unresolvedHetStatuses = new Set(['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'])

export function getHetExceptionCount(order: Order): number {
  return order.items.filter((item) => unresolvedHetStatuses.has(item.matchStatus)).length
}

function isDocumentComplete(document: Order['siplah']['documents'][number]): boolean {
  return (
    document.available &&
    Boolean(document.fileName) &&
    document.verified &&
    (!document.sendToSchoolRequired || document.sentToSchool)
  )
}

export function isSiplahReadyForVendor(order: Order): boolean {
  const process = order.siplah
  const vendorDocumentsComplete = process.documents
    .filter((document) => document.requiredForVendorReady)
    .every(isDocumentComplete)

  return (
    process.accessAvailable &&
    process.orderPlaced &&
    Boolean(process.orderNumber) &&
    order.finalInvoiceAmount !== null &&
    vendorDocumentsComplete
  )
}

export function isSiplahAdminComplete(order: Order): boolean {
  const process = order.siplah
  const adminDocumentsComplete = process.documents
    .filter((document) => document.requiredForAdminCompletion)
    .every(isDocumentComplete)
  return (
    process.orderPlaced &&
    Boolean(process.orderNumber) &&
    order.finalInvoiceAmount !== null &&
    adminDocumentsComplete
  )
}

export function isReadyToDeliver(order: Order): boolean {
  return (
    order.goods.arrivedAt !== null &&
    order.goods.arrivalType !== 'NONE' &&
    order.goods.preDeliveryCheckCompleted
  )
}

export type ClosureCheckpointKey =
  | 'FULFILLMENT'
  | 'SCHOOL_ACCEPTANCE'
  | 'SIPLAH_ADMIN'
  | 'SCHOOL_PAYMENT'
  | 'BENEFIT'
  | 'SUPPLIER_PAYMENT'

export interface ClosureChecklistItem {
  key: ClosureCheckpointKey
  label: string
  complete: boolean
  blocking: boolean
  detail: string
}

function isFulfillmentComplete(order: Order): boolean {
  return (
    order.fulfillment.progressPercent === 100 &&
    order.fulfillment.deliveredQty === order.fulfillment.orderedQty &&
    order.fulfillment.remainingQty === 0
  )
}

function getSiplahAdminMissingRequirements(order: Order): string[] {
  const missing: string[] = []
  if (!order.siplah.orderPlaced) missing.push('pesanan SIPLah dibuat')
  if (!order.siplah.orderNumber) missing.push('nomor order SIPLah')
  for (const document of order.siplah.documents) {
    if (document.requiredForAdminCompletion && !isDocumentComplete(document)) {
      missing.push(document.label)
    }
  }
  return missing
}

export function getClosureChecklist(order: Order): ClosureChecklistItem[] {
  const fulfillmentComplete = isFulfillmentComplete(order)
  const siplahAdminComplete = isSiplahAdminComplete(order)
  const missingSiplahRequirements = getSiplahAdminMissingRequirements(order)
  const supplierComplete = order.supplierPayment.status === 'PAID'

  return [
    {
      key: 'FULFILLMENT',
      label: 'Fulfillment seluruh order 100%',
      complete: fulfillmentComplete,
      blocking: true,
      detail: fulfillmentComplete
        ? `${order.fulfillment.deliveredQty} dari ${order.fulfillment.orderedQty} buku tercatat diterima.`
        : `Masih tersisa ${order.fulfillment.remainingQty} buku; progress tracker ${order.fulfillment.progressPercent}%.`,
    },
    {
      key: 'SCHOOL_ACCEPTANCE',
      label: 'Penerimaan barang oleh sekolah',
      complete: order.goods.acceptedBySchoolAt !== null,
      blocking: true,
      detail: order.goods.acceptedBySchoolAt
        ? 'Penerimaan seluruh order sudah dikonfirmasi sekolah.'
        : 'Konfirmasi penerimaan seluruh order oleh sekolah belum dicatat.',
    },
    {
      key: 'SIPLAH_ADMIN',
      label: 'Administrasi SIPLah lengkap',
      complete: siplahAdminComplete,
      blocking: true,
      detail: siplahAdminComplete
        ? 'Pesanan, nomor order, Invoice, Kwitansi, dan BAST lengkap.'
        : `Belum lengkap: ${missingSiplahRequirements.join(', ') || 'checkpoint administrasi SIPLah'}.`,
    },
    {
      key: 'SCHOOL_PAYMENT',
      label: 'Pembayaran sekolah LUNAS',
      complete: order.schoolPayment.status === 'LUNAS',
      blocking: true,
      detail: order.schoolPayment.status === 'LUNAS'
        ? 'Pembayaran gross sudah dikonfirmasi LUNAS.'
        : 'Pembayaran sekolah belum dikonfirmasi LUNAS.',
    },
    {
      key: 'BENEFIT',
      label: 'Benefit sekolah PAID',
      complete: order.benefit.status === 'PAID',
      blocking: true,
      detail: order.benefit.status === 'PAID'
        ? 'Benefit sudah dibayar penuh.'
        : 'Benefit sekolah belum dibayar penuh.',
    },
    {
      key: 'SUPPLIER_PAYMENT',
      label: 'Pembayaran supplier',
      complete: supplierComplete,
      blocking: false,
      detail: supplierComplete
        ? 'Supplier sudah PAID.'
        : `Status supplier ${order.supplierPayment.status}; tidak memblokir penutupan order.`,
    },
  ]
}

export function isCompletionReady(order: Order): boolean {
  return getClosureChecklist(order)
    .filter((item) => item.blocking)
    .every((item) => item.complete)
}

export function deriveActiveLifecycleStage(order: Order): Exclude<Order['stage'], 'CLOSED'> {
  if (getHetExceptionCount(order) > 0 || order.het.status !== 'APPROVED') return 'HET_REVIEW'
  if (!isSiplahReadyForVendor(order)) return 'SIPLAH'
  if (order.goods.arrivedAt === null || order.goods.arrivalType === 'NONE') return 'VENDOR'
  if (!order.goods.preDeliveryCheckCompleted) return 'GOODS_ARRIVED'
  if (!isFulfillmentComplete(order) || order.goods.acceptedBySchoolAt === null) return 'DISTRIBUTION'
  return 'COMPLETION'
}
