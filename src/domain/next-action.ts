import type { NextAction, Order, VendorBatch } from './types'

function action(
  order: Order,
  input: Omit<NextAction, 'id' | 'orderId' | 'dueAt' | 'source'>,
): NextAction {
  return {
    ...input,
    id: `${order.id}:${input.kind}`,
    orderId: order.id,
    dueAt: null,
    source: 'SYSTEM',
  }
}

export function isActionSnoozed(order: Order, now = new Date()): boolean {
  const value = order.nextActionControl.snoozedUntil
  return value !== null && new Date(value).getTime() > now.getTime()
}

export function deriveNextAction(order: Order, batch: VendorBatch | null): NextAction | null {
  if (order.stage === 'CLOSED') return null

  const override = order.nextActionControl.override
  if (override) {
    return {
      id: `${order.id}:manual`,
      kind: 'MANUAL',
      orderId: order.id,
      title: override.title,
      reason: override.reason || 'Next action diatur manual oleh operator.',
      href: `/orders/${order.id}`,
      ctaLabel: 'Buka order',
      priority: 0,
      dueAt: override.dueAt,
      source: 'MANUAL',
    }
  }

  const exceptions = order.items.filter((item) =>
    ['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(item.matchStatus),
  ).length
  if (exceptions > 0) {
    return action(order, {
      kind: 'REVIEW_HET',
      title: `Review ${exceptions} selisih HET`,
      reason: 'Selisih harus diputuskan sebelum pesanan dapat diproses di SIPLah.',
      href: `/orders/${order.id}?tab=arkas`,
      ctaLabel: 'Review HET',
      priority: 10,
    })
  }

  const siplah = order.siplah
  const siplahComplete =
    siplah.accessAvailable &&
    siplah.orderPlaced &&
    Boolean(siplah.orderNumber) &&
    siplah.suratPesananAvailable &&
    siplah.suratPesananAttached &&
    siplah.suratPesananSentToSchool &&
    siplah.adminCompleted

  if (order.het.status === 'APPROVED' && !siplahComplete) {
    const title = siplah.orderPlaced
      ? 'Lengkapi Surat Pesanan SIPLah'
      : 'Belanjakan pesanan di TokoLadang/SIPLah'
    return action(order, {
      kind: 'COMPLETE_SIPLAH',
      title,
      reason: 'HET sudah disetujui; lanjutkan checkpoint SIPLah yang belum selesai.',
      href: `/orders/${order.id}?tab=siplah`,
      ctaLabel: 'Buka SIPLah',
      priority: 20,
    })
  }

  if (siplahComplete && order.vendorBatchId === null) {
    return action(order, {
      kind: 'ADD_TO_VENDOR_BATCH',
      title: 'Masukkan ke Vendor Batch',
      reason: 'SIPLah selesai dan item siap digabung dengan pesanan sekolah lain.',
      href: `/orders/${order.id}?tab=vendor`,
      ctaLabel: 'Buka vendor',
      priority: 30,
    })
  }

  if (order.goods.arrivedAt !== null && !order.goods.preDeliveryCheckCompleted) {
    return action(order, {
      kind: 'CHECK_GOODS',
      title: 'Cek barang dan jadwalkan pengantaran',
      reason: 'Barang sudah tiba di JPA tetapi belum melalui pemeriksaan pra-kirim.',
      href: `/orders/${order.id}?tab=distribution`,
      ctaLabel: 'Cek barang',
      priority: 40,
    })
  }

  if (order.fulfillment.remainingQty > 0 && order.goods.preDeliveryCheckCompleted) {
    return action(order, {
      kind: 'CONTINUE_FULFILLMENT',
      title: `Lanjutkan pemenuhan · sisa ${order.fulfillment.remainingQty} buku`,
      reason: `${order.fulfillment.problemCount} masalah masih tercatat di Kelengkapan Tracker.`,
      href: `/orders/${order.id}?tab=distribution`,
      ctaLabel: 'Lihat distribusi',
      priority: 50,
    })
  }

  if (
    order.schoolPayment.status === 'UNPAID' &&
    order.schoolPayment.followUpDueAt !== null
  ) {
    return {
      ...action(order, {
        kind: 'FOLLOW_UP_PAYMENT',
        title: 'Follow-up pembayaran sekolah',
        reason: 'Tanggal follow-up pembayaran sudah dijadwalkan.',
        href: `/orders/${order.id}?tab=finance`,
        ctaLabel: 'Buka pembayaran',
        priority: 60,
      }),
      dueAt: order.schoolPayment.followUpDueAt,
    }
  }

  if (order.schoolPayment.status === 'LUNAS' && order.benefit.status === 'ELIGIBLE') {
    const amount = Math.round(order.finalInvoiceAmount * 0.1)
    return action(order, {
      kind: 'PAY_BENEFIT',
      title: `Bayar benefit ${new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(amount)}`,
      reason: 'Pembayaran sekolah sudah LUNAS; benefit 10% belum dibayarkan.',
      href: `/orders/${order.id}?tab=finance`,
      ctaLabel: 'Buka benefit',
      priority: 70,
    })
  }

  const completionReady =
    order.fulfillment.progressPercent === 100 &&
    order.goods.acceptedBySchoolAt !== null &&
    siplahComplete &&
    order.schoolPayment.status === 'LUNAS' &&
    order.benefit.status === 'PAID'
  if (completionReady) {
    return action(order, {
      kind: 'CLOSE_ORDER',
      title: 'Tutup order',
      reason: 'Checkpoint barang, SIPLah, pembayaran sekolah, dan benefit sudah lengkap.',
      href: `/orders/${order.id}`,
      ctaLabel: 'Review penutupan',
      priority: 80,
    })
  }

  if (batch && ['SENT_TO_VENDOR', 'VENDOR_CONFIRMED', 'PROCESSING'].includes(batch.status)) {
    return action(order, {
      kind: 'FOLLOW_UP_VENDOR',
      title: 'Tunggu / follow-up vendor bila perlu',
      reason: `${batch.id} sedang ${batch.status === 'PROCESSING' ? 'diproses vendor' : 'menunggu proses berikutnya'}.`,
      href: `/orders/${order.id}?tab=vendor`,
      ctaLabel: 'Lihat vendor',
      priority: 90,
    })
  }

  return null
}
