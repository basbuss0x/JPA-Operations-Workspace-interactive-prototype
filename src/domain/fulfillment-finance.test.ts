import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import { deriveActionCandidates } from './next-action'
import {
  deriveActiveLifecycleStage,
  getClosureChecklist,
  isCompletionReady,
} from './order-state'
import {
  addTimelineNote,
  closeOrder,
  completePreDeliveryCheck,
  recordBenefitPayment,
  recordBenefitSchoolConfirmation,
  recordSchoolAcceptance,
  recordSchoolPayment,
  refreshFulfillmentSummary,
  reopenOrder,
  setNextActionOverride,
  snoozeOrderAction,
} from './transitions'
import type { Order } from './types'

const now = new Date('2026-02-21T08:00:00.000Z')

function canonicalOrder(id: string): Order {
  const order = createCanonicalDemoData().orders[id]
  if (!order) throw new Error(`Missing canonical order ${id}`)
  return order
}

function payCanonical68(deductionAmount = 350_000): Order {
  const order = canonicalOrder('ORD-2026-068')
  if (order.finalInvoiceAmount === null) throw new Error('Missing final invoice')
  return recordSchoolPayment(
    order,
    {
      schoolPaidAmount: order.finalInvoiceAmount,
      deductionAmount,
      netReceivedAmount: order.finalInvoiceAmount - deductionAmount,
      method: 'SIPLah settlement',
      evidenceName: 'settlement-068.pdf',
    },
    now,
  )
}

function payBenefit(order: Order): Order {
  if (order.benefit.obligationAmount === null) throw new Error('Missing benefit obligation')
  return recordBenefitPayment(
    order,
    {
      amount: order.benefit.obligationAmount,
      method: 'TRANSFER',
      recipientType: 'SCHOOL_OFFICIAL',
      recipient: 'Bendahara SDN 68',
      accountReference: 'BANK-068',
      proofName: 'benefit-068.pdf',
    },
    now,
  )
}

describe('goods check and cached fulfillment boundary', () => {
  it('turns vendor arrival into CHECK_GOODS until an explicit check is completed', () => {
    const arrived = canonicalOrder('ORD-2026-239')
    expect(deriveActionCandidates(arrived, { vendorBatch: null }, now).map((action) => action.kind))
      .toContain('CHECK_GOODS')

    const checked = completePreDeliveryCheck(arrived, 'Jumlah kardus sesuai surat jalan.', now)
    expect(checked.goods.preDeliveryCheckCompleted).toBe(true)
    expect(checked.goods.checkedAt).toBe(now.toISOString())
    expect(checked.goods.checkNote).toBe('Jumlah kardus sesuai surat jalan.')
    expect(checked.stage).toBe('DISTRIBUTION')
    expect(deriveActionCandidates(checked, { vendorBatch: null }, now).map((action) => action.kind))
      .toContain('CONTINUE_FULFILLMENT')
  })

  it('does not treat goods check as school delivery', () => {
    const arrived = canonicalOrder('ORD-2026-239')
    const before = structuredClone(arrived.fulfillment)
    const checked = completePreDeliveryCheck(arrived, '', now)

    expect(checked.fulfillment).toEqual(before)
    expect(checked.goods.acceptedBySchoolAt).toBeNull()
    expect(checked.fulfillment.deliveredQty).toBe(0)
    expect(checked.fulfillment.remainingQty).toBe(186)
  })

  it('keeps whole-order remaining when one discrepancy-free delivery is only part of the order', () => {
    const source = canonicalOrder('ORD-2026-239')
    const eightBookOrder: Order = {
      ...source,
      fulfillment: {
        ...source.fulfillment,
        orderedQty: 8,
        deliveredQty: 0,
        remainingQty: 8,
        progressPercent: 0,
      },
    }
    const refreshed = refreshFulfillmentSummary(
      eightBookOrder,
      { status: 'OK', deliveredQty: 1, problemCount: 0 },
      now,
    )

    expect(refreshed.fulfillment.deliveredQty).toBe(1)
    expect(refreshed.fulfillment.problemCount).toBe(0)
    expect(refreshed.fulfillment.remainingQty).toBe(7)
    expect(refreshed.fulfillment.progressPercent).toBe(13)
  })

  it('keeps canonical whole-order fulfillment semantics with 67 remaining', () => {
    const order = canonicalOrder('ORD-2026-065')
    expect(order.fulfillment).toMatchObject({
      orderedQty: 314,
      deliveredQty: 247,
      remainingQty: 67,
      progressPercent: 79,
    })
    expect(order.fulfillment.remainingQty).toBe(
      order.fulfillment.orderedQty - order.fulfillment.deliveredQty,
    )
  })

  it('preserves cached quantities when tracker sync fails', () => {
    const order = canonicalOrder('ORD-2026-065')
    const failed = refreshFulfillmentSummary(
      order,
      { status: 'ERROR', message: 'Tracker tidak dapat dijangkau.' },
      now,
    )

    expect(failed.fulfillment.orderedQty).toBe(314)
    expect(failed.fulfillment.deliveredQty).toBe(247)
    expect(failed.fulfillment.remainingQty).toBe(67)
    expect(failed.fulfillment.lastUpdated).toBe(order.fulfillment.lastUpdated)
    expect(failed.fulfillment.lastSyncAttemptAt).toBe(now.toISOString())
    expect(failed.fulfillment.syncStatus).toBe('ERROR')
  })

  it('updates and derives the cached summary when cumulative delivery increases from 247 to 300', () => {
    const order = canonicalOrder('ORD-2026-065')
    const refreshed = refreshFulfillmentSummary(
      order,
      { status: 'OK', deliveredQty: 300, problemCount: 1 },
      now,
    )

    expect(refreshed.fulfillment).toMatchObject({
      orderedQty: 314,
      deliveredQty: 300,
      remainingQty: 14,
      problemCount: 1,
      progressPercent: 96,
      lastUpdated: now.toISOString(),
      lastSyncAttemptAt: now.toISOString(),
      syncStatus: 'OK',
    })
  })

  it('preserves the last known good cumulative cache when an OK snapshot regresses from 300 to 247', () => {
    const order = canonicalOrder('ORD-2026-065')
    const cached = refreshFulfillmentSummary(
      order,
      { status: 'OK', deliveredQty: 300, problemCount: 1 },
      new Date('2026-02-20T08:00:00.000Z'),
    )
    const before = structuredClone(cached.fulfillment)
    const conflicted = refreshFulfillmentSummary(
      cached,
      { status: 'OK', deliveredQty: 247, problemCount: 9 },
      now,
    )

    expect(conflicted.fulfillment).toMatchObject({
      orderedQty: 314,
      deliveredQty: 300,
      remainingQty: 14,
      problemCount: 1,
      progressPercent: 96,
      lastUpdated: before.lastUpdated,
      lastSyncAttemptAt: now.toISOString(),
      syncStatus: 'STALE',
    })
    expect(conflicted.fulfillment.syncMessage).toMatch(/247.*300|300.*247/)
    expect(conflicted.timeline).toHaveLength(cached.timeline.length + 1)
    expect(conflicted.timeline[0]?.title).toMatch(/konflik/i)
    expect(conflicted.timeline[0]?.detail).toMatch(/cache terakhir dipertahankan/i)
  })

  it('does not regress a completion-stage order when refreshing its independent tracker cache', () => {
    const order = canonicalOrder('ORD-2026-068')
    const refreshed = refreshFulfillmentSummary(
      order,
      { status: 'OK', deliveredQty: 275, problemCount: 0 },
      now,
    )
    expect(refreshed.stage).toBe('COMPLETION')
  })

  it('cannot silently make a 100% fulfilled order incomplete from an older snapshot', () => {
    const completed = canonicalOrder('ORD-2026-068')
    const conflicted = refreshFulfillmentSummary(
      completed,
      { status: 'OK', deliveredQty: 247, problemCount: 3 },
      now,
    )

    expect(conflicted.stage).toBe('COMPLETION')
    expect(conflicted.fulfillment).toMatchObject({
      deliveredQty: 275,
      remainingQty: 0,
      progressPercent: 100,
      problemCount: 0,
      syncStatus: 'STALE',
    })
    expect(conflicted.fulfillment.syncMessage).toMatch(/247.*275|275.*247/)
  })

  it('cannot use school acceptance to manufacture fulfillment completion', () => {
    const incomplete = canonicalOrder('ORD-2026-065')
    expect(() => recordSchoolAcceptance(incomplete, now)).toThrow(/seluruh order 100%/)
    expect(incomplete.goods.acceptedBySchoolAt).toBeNull()
    expect(incomplete.fulfillment.remainingQty).toBe(67)
  })

  it('appends meaningful check, refresh, failure, and acceptance events', () => {
    const arrived = canonicalOrder('ORD-2026-239')
    const checked = completePreDeliveryCheck(arrived, '', now)
    const refreshed = refreshFulfillmentSummary(
      checked,
      { status: 'OK', deliveredQty: 186, problemCount: 0 },
      now,
    )
    const accepted = recordSchoolAcceptance(refreshed, now)
    const failed = refreshFulfillmentSummary(
      canonicalOrder('ORD-2026-065'),
      { status: 'STALE', message: 'Belum ada snapshot baru.' },
      now,
    )

    expect(checked.timeline[0]?.title).toBe('Pemeriksaan barang selesai')
    expect(refreshed.timeline[0]?.title).toBe('Ringkasan fulfillment diperbarui')
    expect(accepted.timeline[0]?.title).toBe('Barang diterima sekolah')
    expect(failed.timeline[0]?.title).toBe('Ringkasan tracker masih stale')
  })
})

describe('school payment gross, deduction, and net semantics', () => {
  it('confirms LUNAS from gross invoice while allowing deductions to reduce net received', () => {
    const paid = payCanonical68()

    expect(paid.schoolPayment).toMatchObject({
      status: 'LUNAS',
      schoolPaidAmount: 24_350_000,
      deductionAmount: 350_000,
      netReceivedAmount: 24_000_000,
    })
    expect(paid.benefit.status).toBe('ELIGIBLE')
    expect(paid.benefit.baseAmount).toBe(24_350_000)
    expect(paid.benefit.obligationAmount).toBe(2_435_000)
  })

  it('rejects invalid gross and inconsistent net settlement', () => {
    const order = canonicalOrder('ORD-2026-068')
    expect(() => recordSchoolPayment(order, {
      schoolPaidAmount: 24_000_000,
      deductionAmount: 0,
      method: 'Transfer',
      evidenceName: 'proof.pdf',
    }, now)).toThrow(/gross harus sama/)

    expect(() => recordSchoolPayment(order, {
      schoolPaidAmount: 24_350_000,
      deductionAmount: 350_000,
      netReceivedAmount: 23_900_000,
      method: 'Settlement',
      evidenceName: 'proof.pdf',
    }, now)).toThrow(/Net received/)

    expect(() => recordSchoolPayment(order, {
      schoolPaidAmount: 24_350_000,
      deductionAmount: 25_000_000,
      method: 'Settlement',
      evidenceName: 'proof.pdf',
    }, now)).toThrow(/tidak boleh melebihi/)
  })

  it('freezes benefit at exactly 10% of gross final invoice, never net received', () => {
    const paid = payCanonical68(1_350_000)
    const changed: Order = { ...paid, finalInvoiceAmount: 30_000_000 }

    expect(paid.schoolPayment.netReceivedAmount).toBe(23_000_000)
    expect(paid.benefit.obligationAmount).toBe(2_435_000)
    expect(changed.benefit.obligationAmount).toBe(2_435_000)
  })

  it('requires and stores a trimmed transfer reference for an exact full benefit payment', () => {
    const paid = payCanonical68()
    if (paid.benefit.obligationAmount === null) throw new Error('Missing benefit obligation')
    const benefitPaid = recordBenefitPayment(paid, {
      amount: paid.benefit.obligationAmount,
      method: 'TRANSFER',
      recipientType: 'SCHOOL_OFFICIAL',
      recipient: 'Bendahara SDN 68',
      accountReference: '  BANK-068  ',
      proofName: 'benefit-068.pdf',
    }, now)

    expect(benefitPaid.benefit).toMatchObject({
      status: 'PAID',
      obligationAmount: 2_435_000,
      method: 'TRANSFER',
      recipientType: 'SCHOOL_OFFICIAL',
      recipient: 'Bendahara SDN 68',
      accountReference: 'BANK-068',
    })
  })

  it('rejects a transfer benefit without an account reference', () => {
    const paid = payCanonical68()
    const obligationAmount = paid.benefit.obligationAmount
    if (obligationAmount === null) throw new Error('Missing benefit obligation')

    expect(() => recordBenefitPayment(paid, {
      amount: obligationAmount,
      method: 'TRANSFER',
      recipientType: 'SCHOOL_OFFICIAL',
      recipient: 'Bendahara SDN 68',
      accountReference: '   ',
      proofName: 'benefit-068.pdf',
    }, now)).toThrow(/Referensi rekening\/transfer wajib/)
  })

  it('stores no account reference for CASH even when stale transfer text is supplied', () => {
    const paid = payCanonical68()
    if (paid.benefit.obligationAmount === null) throw new Error('Missing benefit obligation')
    const benefitPaid = recordBenefitPayment(paid, {
      amount: paid.benefit.obligationAmount,
      method: 'CASH',
      recipientType: 'INDIVIDUAL',
      recipient: 'Kepala Sekolah',
      accountReference: 'STALE-BANK-REFERENCE',
      proofName: 'cash-proof.jpg',
    }, now)

    expect(benefitPaid.benefit).toMatchObject({
      status: 'PAID',
      obligationAmount: 2_435_000,
      method: 'CASH',
      accountReference: null,
    })
  })

  it('rejects partial benefit while preserving one-time full-payment semantics', () => {
    const paid = payCanonical68()
    expect(() => recordBenefitPayment(paid, {
      amount: 1_000_000,
      method: 'CASH',
      recipientType: 'INDIVIDUAL',
      recipient: 'Kepala Sekolah',
      accountReference: '',
      proofName: 'cash-proof.jpg',
    }, now)).toThrow(/dibayar penuh/)
  })

  it('records payment and benefit eligibility as meaningful separate timeline events', () => {
    const paid = payCanonical68()
    expect(paid.timeline.slice(0, 2).map((event) => event.title)).toEqual([
      'Benefit menjadi eligible',
      'Pembayaran sekolah LUNAS',
    ])
    expect(paid.timeline[1]?.detail).toContain('potongan Rp350.000')
    expect(payBenefit(paid).timeline[0]?.title).toBe('Benefit dibayar')
  })
})

describe('parallel actions and explicit company closure', () => {
  it('keeps fulfillment and benefit obligations active together', () => {
    const order = canonicalOrder('ORD-2026-065')
    const kinds = deriveActionCandidates(order, { vendorBatch: null }, now).map((action) => action.kind)
    expect(kinds).toEqual(['CONTINUE_FULFILLMENT', 'PAY_BENEFIT'])
  })

  it('ignores supplier state and optional benefit confirmation for closure readiness', () => {
    const benefitPaid = payBenefit(payCanonical68())
    expect(benefitPaid.supplierPayment.status).toBe('PARTIAL')
    expect(benefitPaid.benefit.schoolConfirmedAt).toBeNull()
    expect(isCompletionReady(benefitPaid)).toBe(true)
    expect(isCompletionReady({
      ...benefitPaid,
      supplierPayment: { status: 'NOT_SET', obligationAmount: null, paidAmount: 0 },
    })).toBe(true)

    const confirmed = recordBenefitSchoolConfirmation(benefitPaid, now)
    expect(confirmed.benefit.schoolConfirmedAt).toBe(now.toISOString())
    expect(isCompletionReady(confirmed)).toBe(true)
  })

  it('derives blocking and non-blocking closure checklist items from domain state', () => {
    const blocked = canonicalOrder('ORD-2026-068')
    const blockedItems = getClosureChecklist(blocked)
    expect(blockedItems.filter((item) => item.blocking && !item.complete).map((item) => item.key))
      .toEqual(['SCHOOL_PAYMENT', 'BENEFIT'])
    expect(blockedItems.find((item) => item.key === 'SCHOOL_PAYMENT')?.detail)
      .toContain('belum dikonfirmasi LUNAS')
    expect(blockedItems.find((item) => item.key === 'BENEFIT')?.detail)
      .toContain('belum dibayar penuh')

    const ready = payBenefit(payCanonical68())
    expect(getClosureChecklist(ready).filter((item) => item.blocking && !item.complete)).toEqual([])
    expect(getClosureChecklist(ready).find((item) => item.key === 'SUPPLIER_PAYMENT')).toMatchObject({
      complete: false,
      blocking: false,
    })
  })

  it('explains a missing final invoice amount as a concrete closure blocker', () => {
    const source = canonicalOrder('ORD-2026-068')
    const withoutFinalInvoice: Order = { ...source, finalInvoiceAmount: null }
    const siplahItem = getClosureChecklist(withoutFinalInvoice).find((item) => item.key === 'SIPLAH_ADMIN')

    expect(siplahItem).toMatchObject({ complete: false, blocking: true })
    expect(siplahItem?.detail).toContain('nominal final')
    expect(siplahItem?.detail).not.toContain('checkpoint administrasi SIPLah')
  })

  it('blocks closure when each locked requirement is missing', () => {
    const ready = payBenefit(payCanonical68())
    const variants: Order[] = [
      { ...ready, fulfillment: { ...ready.fulfillment, deliveredQty: 274, remainingQty: 1, progressPercent: 99 } },
      { ...ready, goods: { ...ready.goods, acceptedBySchoolAt: null } },
      {
        ...ready,
        siplah: {
          ...ready.siplah,
          documents: ready.siplah.documents.map((document) =>
            document.kind === 'INVOICE' ? { ...document, verified: false } : document),
        },
      },
      { ...ready, schoolPayment: { ...ready.schoolPayment, status: 'UNPAID' } },
      { ...ready, benefit: { ...ready.benefit, status: 'ELIGIBLE' } },
    ]

    for (const variant of variants) {
      expect(isCompletionReady(variant)).toBe(false)
      expect(() => closeOrder(variant, now)).toThrow(/belum memenuhi/)
    }
  })

  it('requires an explicit close transition, is idempotent, and supports reasoned recovery', () => {
    const ready = payBenefit(payCanonical68())
    expect(ready.stage).toBe('COMPLETION')
    expect(deriveActionCandidates(ready, { vendorBatch: null }, now).map((action) => action.kind))
      .toEqual(['CLOSE_ORDER'])

    const closed = closeOrder(ready, now)
    expect(closed.stage).toBe('CLOSED')
    expect(closed.timeline[0]?.title).toBe('Order ditutup')
    expect(deriveActionCandidates(closed, { vendorBatch: null }, now)).toEqual([])

    const duplicateClose = closeOrder(closed, new Date('2026-02-22T08:00:00.000Z'))
    expect(duplicateClose).toEqual(closed)
    expect(duplicateClose.timeline).toHaveLength(closed.timeline.length)

    expect(deriveActiveLifecycleStage(closed)).toBe('COMPLETION')
    expect(() => reopenOrder(closed, '   ', now)).toThrow(/Alasan membuka kembali/)
    const reopened = reopenOrder(closed, 'Koreksi bukti pembayaran sebelum audit.', now)
    expect(reopened.stage).toBe('COMPLETION')
    expect(reopened.timeline).toHaveLength(closed.timeline.length + 1)
    expect(reopened.timeline[0]?.title).toBe('Order dibuka kembali')
    expect(reopened.timeline[0]?.detail).toContain('Koreksi bukti pembayaran sebelum audit.')
  })

  it('guards closed workspace mutations at the domain boundary', () => {
    const ready = payBenefit(payCanonical68())
    const closed = closeOrder(ready, now)

    expect(() => addTimelineNote(closed, 'Harus gagal.', now)).toThrow(/CLOSED/)
    expect(() => setNextActionOverride(closed, {
      title: 'Harus gagal',
      reason: 'Tidak boleh mengubah order tertutup.',
      dueAt: null,
    }, now)).toThrow(/CLOSED/)
    expect(() => snoozeOrderAction(closed, 'CLOSE_ORDER', '2026-02-25T08:00:00.000Z', now)).toThrow(/CLOSED/)
  })

  it('rejects optional benefit school confirmation after the order is CLOSED', () => {
    const ready = payBenefit(payCanonical68())
    const closed = closeOrder(ready, now)
    const before = structuredClone(closed)

    expect(() => recordBenefitSchoolConfirmation(
      closed,
      new Date('2026-02-22T08:00:00.000Z'),
    )).toThrow(/CLOSED/)
    expect(closed).toEqual(before)
    expect(closed.stage).toBe('CLOSED')
    expect(closed.benefit.schoolConfirmedAt).toBeNull()
  })
})
