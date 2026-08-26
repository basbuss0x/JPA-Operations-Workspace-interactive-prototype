import { PRODUCT_MASTER } from '../data/product-master'
import type {
  AggregatedVendorItem,
  Order,
  PrototypeData,
  VendorBatch,
  VendorRecap,
  VendorSchoolBreakdown,
  WorkQueueItem,
} from './types'
import { deriveActionCandidates, getActiveActionCandidates } from './next-action'
import { getHetExceptionCount, isSiplahReadyForVendor } from './order-state'

export {
  getHetExceptionCount,
  isCompletionReady,
  isReadyToDeliver,
  isSiplahAdminComplete,
  isSiplahReadyForVendor,
} from './order-state'

export function isVendorBatchEligible(order: Order): boolean {
  return (
    order.stage !== 'CLOSED' &&
    order.het.status === 'APPROVED' &&
    getHetExceptionCount(order) === 0 &&
    isSiplahReadyForVendor(order) &&
    order.vendorBatchId === null
  )
}

export function calculateBenefitAmount(
  order: Pick<Order, 'finalInvoiceAmount' | 'benefit'>,
): number | null {
  if (order.benefit.obligationAmount !== null) return order.benefit.obligationAmount
  return order.finalInvoiceAmount === null ? null : Math.round(order.finalInvoiceAmount * 0.1)
}

export function isBenefitEligible(order: Order): boolean {
  return order.schoolPayment.status === 'LUNAS' && order.benefit.status === 'ELIGIBLE'
}

export function getOrderBatch(order: Order, batches: Record<string, VendorBatch>): VendorBatch | null {
  return order.vendorBatchId ? (batches[order.vendorBatchId] ?? null) : null
}

export function getOrders(data: Pick<PrototypeData, 'orders'>): Order[] {
  return Object.values(data.orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function getCanonicalVendorProduct(order: Order, item: Order['items'][number]) {
  if (!item.productCode) {
    throw new Error(`${order.id} memiliki item "${item.arkasTitle}" yang belum dipetakan ke Product Master.`)
  }
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new Error(`${order.id} memiliki quantity tidak valid untuk ${item.productCode}.`)
  }
  const masterProduct = PRODUCT_MASTER.find((product) => product.code === item.productCode)
  const title = masterProduct?.title ?? item.masterProductTitle
  if (!title) {
    throw new Error(`${order.id} memiliki kode ${item.productCode} tanpa nama Product Master yang valid.`)
  }
  return { productCode: item.productCode, title }
}

export function aggregateVendorItems(orders: Order[]): AggregatedVendorItem[] {
  const items = new Map<string, AggregatedVendorItem>()

  for (const order of orders) {
    for (const orderItem of order.items) {
      const product = getCanonicalVendorProduct(order, orderItem)
      const existing = items.get(product.productCode)
      if (!existing) {
        items.set(product.productCode, {
          ...product,
          totalQuantity: orderItem.quantity,
          schools: [{ orderId: order.id, schoolName: order.schoolName, quantity: orderItem.quantity }],
        })
        continue
      }

      existing.totalQuantity += orderItem.quantity
      const schoolAllocation = existing.schools.find((school) => school.orderId === order.id)
      if (schoolAllocation) schoolAllocation.quantity += orderItem.quantity
      else {
        existing.schools.push({
          orderId: order.id,
          schoolName: order.schoolName,
          quantity: orderItem.quantity,
        })
      }
    }
  }

  return [...items.values()]
    .map((item) => ({
      ...item,
      schools: [...item.schools].sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'id')),
    }))
    .sort((a, b) => a.productCode.localeCompare(b.productCode, 'id'))
}

export function getVendorSchoolBreakdown(orders: Order[]): VendorSchoolBreakdown[] {
  return orders
    .map((order) => {
      if (!order.siplah.orderNumber) {
        throw new Error(`${order.id} belum memiliki nomor order SIPLah.`)
      }
      const items = new Map<string, VendorSchoolBreakdown['items'][number]>()
      for (const orderItem of order.items) {
        const product = getCanonicalVendorProduct(order, orderItem)
        const existing = items.get(product.productCode)
        if (existing) existing.quantity += orderItem.quantity
        else items.set(product.productCode, { ...product, quantity: orderItem.quantity })
      }
      return {
        orderId: order.id,
        schoolName: order.schoolName,
        siplahOrderNumber: order.siplah.orderNumber,
        items: [...items.values()].sort((a, b) => a.productCode.localeCompare(b.productCode, 'id')),
      }
    })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'id'))
}

export function buildVendorRecap(orders: Order[]): VendorRecap {
  const aggregatedItems = aggregateVendorItems(orders)
  const schoolBreakdown = getVendorSchoolBreakdown(orders)
  return {
    aggregatedItems,
    schoolBreakdown,
    schoolCount: schoolBreakdown.length,
    distinctProductCount: aggregatedItems.length,
    totalQuantity: aggregatedItems.reduce((total, item) => total + item.totalQuantity, 0),
  }
}

export function proposeVendorBatchId(batches: Record<string, VendorBatch>): string {
  const parsed = Object.keys(batches).flatMap((id) => {
    const match = /^VB-(\d{4})-(\d+)$/.exec(id)
    return match?.[1] && match[2]
      ? [{ year: Number(match[1]), sequence: Number(match[2]) }]
      : []
  })
  const year = parsed.length > 0
    ? parsed.reduce((latest, batch) => Math.max(latest, batch.year), 0)
    : new Date().getFullYear()
  const highest = parsed
    .filter((batch) => batch.year === year)
    .reduce((latest, batch) => Math.max(latest, batch.sequence), 0)
  let sequence = highest + 1
  let candidate = `VB-${year}-${String(sequence).padStart(3, '0')}`
  while (batches[candidate]) {
    sequence += 1
    candidate = `VB-${year}-${String(sequence).padStart(3, '0')}`
  }
  return candidate
}

export interface VendorBatchOperationalState {
  label: string
  detail: string
  priority: number
  actionable: boolean
}

function dateReached(value: string | null, now: Date): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time <= now.getTime()
}

export function getVendorBatchOperationalState(
  batch: VendorBatch,
  now: Date,
): VendorBatchOperationalState {
  const reminderDue = dateReached(batch.followUpDueAt, now)
  const reminderRelevant = ['SENT_TO_VENDOR', 'VENDOR_CONFIRMED', 'PROCESSING', 'PARTIALLY_ARRIVED']
    .includes(batch.status)
  if (reminderDue && reminderRelevant) {
    return {
      label: 'Follow-up vendor',
      detail: 'Reminder eksplisit sudah tercapai.',
      priority: 5,
      actionable: true,
    }
  }
  switch (batch.status) {
    case 'DRAFT':
      return { label: 'Generate recap', detail: 'Batch belum memiliki workbook recap.', priority: 10, actionable: true }
    case 'RECAP_GENERATED':
      return { label: 'Kirim ke vendor', detail: 'Rekap sudah dibuat, belum dikirim ke vendor.', priority: 20, actionable: true }
    case 'SENT_TO_VENDOR':
      return { label: 'Menunggu konfirmasi vendor', detail: 'Follow-up hanya muncul jika reminder eksplisit tercapai.', priority: 60, actionable: false }
    case 'VENDOR_CONFIRMED':
      return { label: 'Mulai processing', detail: 'Konfirmasi vendor sudah tercatat.', priority: 30, actionable: true }
    case 'PROCESSING':
      return { label: 'Menunggu vendor', detail: 'Pasif tanpa reminder follow-up.', priority: 70, actionable: false }
    case 'PARTIALLY_ARRIVED':
      return { label: 'Catat kedatangan berikutnya', detail: 'Sebagian sekolah/order sudah menerima alokasi.', priority: 50, actionable: true }
    case 'ARRIVED':
      return { label: 'Barang tiba', detail: 'Goods handling dilanjutkan pada alur distribusi.', priority: 100, actionable: false }
  }
}

export function getVendorBatchOrders(
  batch: VendorBatch,
  orders: Record<string, Order>,
): Order[] {
  return batch.orderIds.flatMap((orderId) => {
    const order = orders[orderId]
    return order ? [order] : []
  })
}

export function getOrderActionCandidates(
  order: Order,
  batches: Record<string, VendorBatch>,
  now: Date,
) {
  return deriveActionCandidates(order, { vendorBatch: getOrderBatch(order, batches) }, now)
}

export function deriveWorkQueue(
  data: Pick<PrototypeData, 'orders' | 'vendorBatches'>,
  now: Date,
): WorkQueueItem[] {
  const items: WorkQueueItem[] = []

  for (const order of Object.values(data.orders)) {
    const candidates = getActiveActionCandidates(
      getOrderActionCandidates(order, data.vendorBatches, now),
    )
    for (const action of candidates) {
      items.push({
        ...action,
        schoolName: order.schoolName,
        orderIds: [order.id],
        context: `${order.schoolName} · ${order.id}`,
      })
    }
  }

  const vendorItems = items.filter((item) => item.kind === 'ADD_TO_VENDOR_BATCH')
  const vendorFollowUps = items.filter((item) => item.kind === 'FOLLOW_UP_VENDOR')
  const rest = items.filter(
    (item) => item.kind !== 'ADD_TO_VENDOR_BATCH' && item.kind !== 'FOLLOW_UP_VENDOR',
  )
  if (vendorItems.length > 0) {
    const first = vendorItems[0]
    if (first) {
      rest.push({
        ...first,
        id: 'queue-vendor-ready',
        title: `${vendorItems.length} pesanan siap masuk Vendor Batch`,
        reason: 'Data item sudah terstruktur dan dapat direkap tanpa input ulang.',
        href: '/vendor-batches/new',
        ctaLabel: 'Buat batch',
        schoolName: `${vendorItems.length} sekolah`,
        orderIds: vendorItems.flatMap((item) => item.orderIds),
        context: vendorItems.map((item) => item.schoolName).join(' · '),
      })
    }
  }

  const followUpsByBatch = new Map<string, WorkQueueItem[]>()
  for (const item of vendorFollowUps) {
    const batchId = data.orders[item.orderId]?.vendorBatchId
    if (!batchId) continue
    followUpsByBatch.set(batchId, [...(followUpsByBatch.get(batchId) ?? []), item])
  }
  for (const [batchId, batchItems] of followUpsByBatch) {
    const first = batchItems[0]
    if (!first) continue
    rest.push({
      ...first,
      id: `queue-follow-up-${batchId}`,
      title: `Follow-up vendor · ${batchId}`,
      reason: `Reminder batch sudah tercapai; ${batchItems.length} sekolah menunggu tindak lanjut yang sama.`,
      href: `/vendor-batches/${batchId}`,
      ctaLabel: 'Buka batch',
      schoolName: batchId,
      orderIds: batchItems.flatMap((item) => item.orderIds),
      context: `${batchId} · ${batchItems.map((item) => item.schoolName).join(' · ')}`,
    })
  }

  return rest.sort((a, b) => a.priority - b.priority || a.schoolName.localeCompare(b.schoolName, 'id'))
}

export type OrderFilter =
  | 'all'
  | 'needs-action'
  | 'het-problem'
  | 'ready-siplah'
  | 'ready-vendor'
  | 'goods-arrived'
  | 'unpaid'
  | 'benefit-eligible'

export function matchesOrderFilter(
  order: Order,
  filter: OrderFilter,
  batches: Record<string, VendorBatch>,
  now: Date,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'needs-action':
      return getActiveActionCandidates(getOrderActionCandidates(order, batches, now)).length > 0
    case 'het-problem':
      return getHetExceptionCount(order) > 0
    case 'ready-siplah':
      return order.het.status === 'APPROVED' && !isSiplahReadyForVendor(order)
    case 'ready-vendor':
      return isVendorBatchEligible(order)
    case 'goods-arrived':
      return order.goods.arrivedAt !== null && !order.goods.preDeliveryCheckCompleted
    case 'unpaid':
      return order.schoolPayment.status === 'UNPAID'
    case 'benefit-eligible':
      return isBenefitEligible(order)
  }
}

export function matchesOrderSearch(order: Order, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('id')
  if (!normalized) return true
  return [
    order.schoolName,
    order.id,
    order.siplah.orderNumber ?? '',
    order.arkas.reference,
  ].some((value) => value.toLocaleLowerCase('id').includes(normalized))
}
