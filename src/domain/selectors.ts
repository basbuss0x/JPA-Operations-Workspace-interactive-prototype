import type {
  AggregatedVendorItem,
  Order,
  PrototypeData,
  VendorBatch,
  WorkQueueItem,
} from './types'
import { deriveNextAction, isActionSnoozed } from './next-action'

const unresolvedHetStatuses = new Set(['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'])

export function getHetExceptionCount(order: Order): number {
  return order.items.filter((item) => unresolvedHetStatuses.has(item.matchStatus)).length
}

export function isSiplahComplete(order: Order): boolean {
  const process = order.siplah
  return (
    process.accessAvailable &&
    process.orderPlaced &&
    Boolean(process.orderNumber) &&
    process.suratPesananAvailable &&
    process.suratPesananAttached &&
    process.suratPesananSentToSchool &&
    process.adminCompleted
  )
}

export function isVendorBatchEligible(order: Order): boolean {
  return (
    order.stage !== 'CLOSED' &&
    order.het.status === 'APPROVED' &&
    getHetExceptionCount(order) === 0 &&
    isSiplahComplete(order) &&
    order.vendorBatchId === null
  )
}

export function calculateBenefitAmount(order: Pick<Order, 'finalInvoiceAmount'>): number {
  return Math.round(order.finalInvoiceAmount * 0.1)
}

export function isBenefitEligible(order: Order): boolean {
  return order.schoolPayment.status === 'LUNAS' && order.benefit.status !== 'PAID'
}

export function isCompletionReady(order: Order): boolean {
  return (
    order.fulfillment.progressPercent === 100 &&
    order.fulfillment.remainingQty === 0 &&
    order.goods.acceptedBySchoolAt !== null &&
    isSiplahComplete(order) &&
    order.schoolPayment.status === 'LUNAS' &&
    order.benefit.status === 'PAID'
  )
}

export function getOrderBatch(order: Order, batches: Record<string, VendorBatch>): VendorBatch | null {
  return order.vendorBatchId ? (batches[order.vendorBatchId] ?? null) : null
}

export function getOrders(data: Pick<PrototypeData, 'orders'>): Order[] {
  return Object.values(data.orders).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function aggregateVendorItems(orders: Order[]): AggregatedVendorItem[] {
  const items = new Map<string, AggregatedVendorItem>()

  for (const order of orders) {
    for (const orderItem of order.items) {
      const title = orderItem.masterProductTitle ?? orderItem.arkasTitle
      const key = `${orderItem.productCode}:${title}`
      const existing = items.get(key)
      if (existing) {
        existing.totalQuantity += orderItem.quantity
        existing.schools.push({
          orderId: order.id,
          schoolName: order.schoolName,
          quantity: orderItem.quantity,
        })
      } else {
        items.set(key, {
          productCode: orderItem.productCode,
          title,
          totalQuantity: orderItem.quantity,
          schools: [
            {
              orderId: order.id,
              schoolName: order.schoolName,
              quantity: orderItem.quantity,
            },
          ],
        })
      }
    }
  }

  return [...items.values()].sort((a, b) => a.title.localeCompare(b.title, 'id'))
}

export function deriveWorkQueue(
  data: Pick<PrototypeData, 'orders' | 'vendorBatches'>,
  now = new Date(),
): WorkQueueItem[] {
  const items: WorkQueueItem[] = []

  for (const order of Object.values(data.orders)) {
    if (isActionSnoozed(order, now)) continue
    const action = deriveNextAction(order, getOrderBatch(order, data.vendorBatches))
    if (!action) continue
    items.push({
      ...action,
      schoolName: order.schoolName,
      orderIds: [order.id],
      context: `${order.schoolName} · ${order.id}`,
    })
  }

  const vendorItems = items.filter((item) => item.kind === 'ADD_TO_VENDOR_BATCH')
  const rest = items.filter((item) => item.kind !== 'ADD_TO_VENDOR_BATCH')
  if (vendorItems.length > 0) {
    const first = vendorItems[0]
    if (first) {
      rest.push({
        ...first,
        id: 'queue-vendor-ready',
        title: `${vendorItems.length} pesanan siap masuk Vendor Batch`,
        reason: 'Data item sudah terstruktur dan dapat direkap tanpa input ulang.',
        href: '/orders?filter=ready-vendor',
        ctaLabel: 'Lihat pesanan',
        schoolName: `${vendorItems.length} sekolah`,
        orderIds: vendorItems.flatMap((item) => item.orderIds),
        context: vendorItems.map((item) => item.schoolName).join(' · '),
      })
    }
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
  now = new Date(),
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'needs-action':
      return !isActionSnoozed(order, now) && deriveNextAction(order, getOrderBatch(order, batches)) !== null
    case 'het-problem':
      return getHetExceptionCount(order) > 0
    case 'ready-siplah':
      return order.het.status === 'APPROVED' && !isSiplahComplete(order)
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
