import { getHetExceptionCount, isCompletionReady } from './order-state'
import { calculateBenefitAmount, isVendorBatchEligible } from './selectors'
import type {
  GoodsArrivalAllocation,
  NextActionKind,
  NextActionOverride,
  Order,
  PrototypeData,
  SiplahProcess,
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

export function resolveHetException(
  order: Order,
  itemId: string,
  note: string,
  now?: Date,
): Order {
  const target = order.items.find((item) => item.id === itemId)
  if (!target || !['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(target.matchStatus)) {
    throw new Error('Item bukan HET exception yang dapat diselesaikan.')
  }
  const next = {
    ...order,
    items: order.items.map((current) =>
      current.id === itemId
        ? { ...current, matchStatus: 'MANUAL_OVERRIDE' as const, resolutionNote: note }
        : current,
    ),
  }
  return withEvent(next, 'HET exception diselesaikan', `${target.arkasTitle}: ${note}`, now)
}

export function confirmHetReview(order: Order, now?: Date): Order {
  if (getHetExceptionCount(order) > 0) {
    throw new Error('Semua HET exception harus diselesaikan sebelum approval.')
  }
  const approvedAt = timestamp(now)
  const next: Order = {
    ...order,
    stage: 'SIPLAH',
    het: { ...order.het, status: 'APPROVED', approvedAt },
  }
  return withEvent(next, 'HET disetujui', 'Review HET dikonfirmasi oleh operator.', now)
}

export function updateSiplahCheckpoint<K extends keyof SiplahProcess>(
  order: Order,
  checkpoint: K,
  value: SiplahProcess[K],
  now?: Date,
): Order {
  const next = {
    ...order,
    siplah: { ...order.siplah, [checkpoint]: value },
  }
  return withEvent(next, 'Checkpoint SIPLah diperbarui', `${checkpoint} diperbarui secara eksplisit.`, now)
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
