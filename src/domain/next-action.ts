import { getHetExceptionCount, isCompletionReady, isSiplahComplete } from './order-state'
import type {
  ActionDerivationContext,
  NextAction,
  NextActionKind,
  Order,
} from './types'

function reached(dueAt: string | null, now: Date): boolean {
  if (!dueAt) return false
  const dueTime = new Date(dueAt).getTime()
  return Number.isFinite(dueTime) && dueTime <= now.getTime()
}

export function getActionSnoozedUntil(order: Order, kind: NextActionKind): string | null {
  return order.nextActionControl.controlsByActionKey[kind]?.snoozedUntil ?? null
}

export function isActionSnoozed(order: Order, kind: NextActionKind, now: Date): boolean {
  const snoozedUntil = getActionSnoozedUntil(order, kind)
  if (!snoozedUntil) return false
  const snoozedTime = new Date(snoozedUntil).getTime()
  return Number.isFinite(snoozedTime) && snoozedTime > now.getTime()
}

function action(
  order: Order,
  now: Date,
  input: Omit<NextAction, 'id' | 'orderId' | 'snoozedUntil' | 'availability' | 'source'>,
): NextAction {
  const snoozedUntil = getActionSnoozedUntil(order, input.kind)
  return {
    ...input,
    id: `${order.id}:${input.kind}`,
    orderId: order.id,
    snoozedUntil,
    availability: isActionSnoozed(order, input.kind, now) ? 'SNOOZED' : 'ACTIVE',
    source: 'SYSTEM',
  }
}

export function deriveActionCandidates(
  order: Order,
  context: ActionDerivationContext,
  now: Date,
): NextAction[] {
  if (order.stage === 'CLOSED') return []

  const candidates: NextAction[] = []
  const override = order.nextActionControl.override
  if (override) {
    const snoozedUntil = getActionSnoozedUntil(order, 'MANUAL')
    candidates.push({
      id: `${order.id}:MANUAL`,
      kind: 'MANUAL',
      orderId: order.id,
      title: override.title,
      reason: override.reason || 'Next action diatur manual oleh operator.',
      href: `/orders/${order.id}`,
      ctaLabel: 'Buka order',
      priority: 0,
      dueAt: override.dueAt,
      snoozedUntil,
      availability: isActionSnoozed(order, 'MANUAL', now) ? 'SNOOZED' : 'ACTIVE',
      source: 'MANUAL',
    })
  }

  const exceptions = getHetExceptionCount(order)
  if (exceptions > 0) {
    candidates.push(
      action(order, now, {
        kind: 'REVIEW_HET',
        title: `Review ${exceptions} selisih HET`,
        reason: 'Selisih harus diputuskan sebelum pesanan dapat diproses di SIPLah.',
        href: `/orders/${order.id}?tab=arkas`,
        ctaLabel: 'Review HET',
        priority: 10,
        dueAt: null,
      }),
    )
  }

  const siplahComplete = isSiplahComplete(order)
  if (order.het.status === 'APPROVED' && !siplahComplete) {
    candidates.push(
      action(order, now, {
        kind: 'COMPLETE_SIPLAH',
        title: order.siplah.orderPlaced
          ? 'Lengkapi dokumen SIPLah'
          : 'Belanjakan pesanan di TokoLadang/SIPLah',
        reason: 'HET sudah disetujui; lanjutkan checkpoint SIPLah yang belum selesai.',
        href: `/orders/${order.id}?tab=siplah`,
        ctaLabel: 'Buka SIPLah',
        priority: 20,
        dueAt: null,
      }),
    )
  }

  if (siplahComplete && order.vendorBatchId === null) {
    candidates.push(
      action(order, now, {
        kind: 'ADD_TO_VENDOR_BATCH',
        title: 'Masukkan ke Vendor Batch',
        reason: 'SIPLah selesai dan item siap digabung dengan pesanan sekolah lain.',
        href: `/orders/${order.id}?tab=vendor`,
        ctaLabel: 'Buka vendor',
        priority: 30,
        dueAt: null,
      }),
    )
  }

  if (order.goods.arrivedAt !== null && !order.goods.preDeliveryCheckCompleted) {
    candidates.push(
      action(order, now, {
        kind: 'CHECK_GOODS',
        title: 'Cek barang dan jadwalkan pengantaran',
        reason: 'Barang sudah tiba di JPA tetapi belum melalui pemeriksaan pra-kirim.',
        href: `/orders/${order.id}?tab=distribution`,
        ctaLabel: 'Cek barang',
        priority: 40,
        dueAt: null,
      }),
    )
  }

  if (order.fulfillment.remainingQty > 0 && order.goods.preDeliveryCheckCompleted) {
    candidates.push(
      action(order, now, {
        kind: 'CONTINUE_FULFILLMENT',
        title: `Lanjutkan pemenuhan · sisa ${order.fulfillment.remainingQty} buku`,
        reason: `${order.fulfillment.problemCount} masalah masih tercatat di Kelengkapan Tracker.`,
        href: `/orders/${order.id}?tab=distribution`,
        ctaLabel: 'Lihat distribusi',
        priority: 50,
        dueAt: null,
      }),
    )
  }

  const paymentDueAt = order.schoolPayment.followUpDueAt
  if (order.schoolPayment.status === 'UNPAID' && reached(paymentDueAt, now)) {
    candidates.push(
      action(order, now, {
        kind: 'FOLLOW_UP_PAYMENT',
        title: 'Follow-up pembayaran sekolah',
        reason: 'Tanggal follow-up pembayaran sudah tercapai.',
        href: `/orders/${order.id}?tab=finance`,
        ctaLabel: 'Buka pembayaran',
        priority: 60,
        dueAt: paymentDueAt,
      }),
    )
  }

  if (order.schoolPayment.status === 'LUNAS' && order.benefit.status === 'ELIGIBLE') {
    const amount = order.benefit.obligationAmount
    const title = amount === null
      ? 'Bayar benefit sekolah'
      : `Bayar benefit ${new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          maximumFractionDigits: 0,
        }).format(amount)}`
    candidates.push(
      action(order, now, {
        kind: 'PAY_BENEFIT',
        title,
        reason: 'Pembayaran sekolah sudah LUNAS; benefit 10% belum dibayarkan.',
        href: `/orders/${order.id}?tab=finance`,
        ctaLabel: 'Buka benefit',
        priority: 70,
        dueAt: null,
      }),
    )
  }

  if (isCompletionReady(order)) {
    candidates.push(
      action(order, now, {
        kind: 'CLOSE_ORDER',
        title: 'Tutup order',
        reason: 'Checkpoint barang, SIPLah, pembayaran sekolah, dan benefit sudah lengkap.',
        href: `/orders/${order.id}`,
        ctaLabel: 'Review penutupan',
        priority: 80,
        dueAt: null,
      }),
    )
  }

  const batch = context.vendorBatch
  if (
    batch &&
    ['SENT_TO_VENDOR', 'VENDOR_CONFIRMED', 'PROCESSING'].includes(batch.status) &&
    reached(batch.followUpDueAt, now)
  ) {
    candidates.push(
      action(order, now, {
        kind: 'FOLLOW_UP_VENDOR',
        title: 'Follow-up vendor',
        reason: `Reminder ${batch.id} sudah tercapai; status saat ini ${batch.status.replaceAll('_', ' ')}.`,
        href: `/orders/${order.id}?tab=vendor`,
        ctaLabel: 'Lihat vendor',
        priority: 90,
        dueAt: batch.followUpDueAt,
      }),
    )
  }

  return candidates
}

export function getActiveActionCandidates(candidates: NextAction[]): NextAction[] {
  return candidates.filter((candidate) => candidate.availability === 'ACTIVE')
}

export function derivePrimaryNextAction(candidates: NextAction[]): NextAction | null {
  const activeCandidates = getActiveActionCandidates(candidates)
  return [...activeCandidates].sort(
    (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
  )[0] ?? null
}
