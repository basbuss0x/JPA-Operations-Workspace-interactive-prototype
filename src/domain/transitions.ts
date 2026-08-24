import { calculateBenefitAmount, getHetExceptionCount, isCompletionReady, isVendorBatchEligible } from './selectors'
import type {
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
  arrivalType: 'PARTIAL' | 'FULL',
  now?: Date,
): PrototypeData {
  const batch = data.vendorBatches[batchId]
  if (!batch) throw new Error('Vendor batch tidak ditemukan.')
  const targetStatus: VendorBatchStatus = arrivalType === 'FULL' ? 'ARRIVED' : 'PARTIALLY_ARRIVED'
  if (!allowedBatchTransitions[batch.status].includes(targetStatus)) {
    throw new Error(`Barang tidak dapat dicatat dari status batch ${batch.status}.`)
  }

  const arrivedAt = timestamp(now)
  const nextOrders = { ...data.orders }
  for (const orderId of batch.orderIds) {
    const order = data.orders[orderId]
    if (!order) continue
    nextOrders[orderId] = withEvent(
      {
        ...order,
        stage: 'GOODS_ARRIVED',
        goods: {
          ...order.goods,
          arrivedAt,
          arrivalType,
          preDeliveryCheckCompleted: false,
          checkedAt: null,
        },
      },
      arrivalType === 'FULL' ? 'Barang tiba di JPA' : 'Sebagian barang tiba di JPA',
      `${batchId} mencatat kedatangan ${arrivalType === 'FULL' ? 'penuh' : 'sebagian'}; pemeriksaan belum dilakukan.`,
      now,
    )
  }

  return {
    ...data,
    orders: nextOrders,
    vendorBatches: {
      ...data.vendorBatches,
      [batchId]: {
        ...batch,
        status: targetStatus,
        arrivedAt: arrivalType === 'FULL' ? arrivedAt : batch.arrivedAt,
      },
    },
  }
}

export function recordSchoolPayment(
  order: Order,
  input: { amount: number; method: string; evidenceName: string },
  now?: Date,
): Order {
  if (input.amount !== order.finalInvoiceAmount) {
    throw new Error('Prototype hanya menerima pembayaran penuh sesuai invoice.')
  }
  const paidAt = timestamp(now)
  const next: Order = {
    ...order,
    schoolPayment: {
      status: 'LUNAS',
      amount: input.amount,
      paidAt,
      method: input.method,
      evidenceName: input.evidenceName,
      followUpDueAt: null,
    },
    benefit:
      order.benefit.status === 'PAID'
        ? order.benefit
        : { ...order.benefit, status: 'ELIGIBLE', eligibleAt: paidAt },
  }
  return withEvent(
    next,
    'Pembayaran sekolah LUNAS',
    `Pembayaran penuh tercatat. Benefit ${calculateBenefitAmount(order).toLocaleString('id-ID')} kini eligible.`,
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
  if (input.amount !== calculateBenefitAmount(order)) {
    throw new Error('Nominal benefit harus tepat 10% dari invoice final.')
  }
  const paidAt = timestamp(now)
  const next: Order = {
    ...order,
    benefit: {
      status: 'PAID',
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
  return {
    ...order,
    updatedAt: createdAt,
    nextActionControl: {
      ...order.nextActionControl,
      override: override ? { ...override, createdAt } : null,
      snoozedUntil: null,
    },
  }
}

export function snoozeOrderAction(order: Order, until: string | null, now?: Date): Order {
  return {
    ...order,
    updatedAt: timestamp(now),
    nextActionControl: { ...order.nextActionControl, snoozedUntil: until },
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
