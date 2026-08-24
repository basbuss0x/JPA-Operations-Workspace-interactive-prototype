import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import {
  confirmHetReview,
  createVendorBatch,
  recordBenefitPayment,
  recordGoodsArrival,
  recordSchoolPayment,
  resolveHetException,
  snoozeOrderAction,
  transitionVendorBatch,
} from './transitions'
import { deriveActionCandidates, derivePrimaryNextAction } from './next-action'
import { calculateBenefitAmount } from './selectors'
import type { Order, PrototypeData } from './types'

const now = new Date('2026-02-21T08:00:00.000Z')

function canonicalOrder(id: string): Order {
  const order = createCanonicalDemoData().orders[id]
  if (!order) throw new Error(`Missing canonical order ${id}`)
  return order
}

function createProcessingBatch(): PrototypeData {
  const data = createCanonicalDemoData()
  const draft = createVendorBatch(data, ['ORD-2026-040', 'ORD-2026-SLB'], 'VB-2026-010', now)
  const recap = transitionVendorBatch(draft, 'VB-2026-010', 'RECAP_GENERATED', now)
  const sent = transitionVendorBatch(recap, 'VB-2026-010', 'SENT_TO_VENDOR', now)
  const confirmed = transitionVendorBatch(sent, 'VB-2026-010', 'VENDOR_CONFIRMED', now)
  return transitionVendorBatch(confirmed, 'VB-2026-010', 'PROCESSING', now)
}

describe('important transitions', () => {
  it('requires every HET exception to be resolved before explicit approval', () => {
    const order = canonicalOrder('ORD-2026-030')
    expect(() => confirmHetReview(order, now)).toThrow(/Semua HET exception/)

    const first = resolveHetException(order, 'math-exception', 'Harga HET disepakati.', now)
    expect(() => confirmHetReview(first, now)).toThrow(/Semua HET exception/)

    const second = resolveHetException(first, 'religion-exception', 'Pilih master PAI Kelas V.', now)
    const approved = confirmHetReview(second, now)
    expect(approved.het.status).toBe('APPROVED')
    expect(approved.stage).toBe('SIPLAH')
    expect(approved.arkasBudgetAmount).toBe(order.arkasBudgetAmount)
  })

  it('creates a vendor batch as DRAFT and never implies it was sent', () => {
    const data = createCanonicalDemoData()
    const next = createVendorBatch(data, ['ORD-2026-040', 'ORD-2026-SLB'], 'VB-2026-010', now)
    const batch = next.vendorBatches['VB-2026-010']

    expect(batch?.status).toBe('DRAFT')
    expect(batch?.sentAt).toBeNull()
    expect(batch?.followUpDueAt).toBeNull()
    expect(next.orders['ORD-2026-040']?.vendorBatchId).toBe('VB-2026-010')
    expect(() => transitionVendorBatch(next, 'VB-2026-010', 'SENT_TO_VENDOR', now)).toThrow()
  })

  it('targets goods arrival by order without mutating sibling batch members', () => {
    const processing = createProcessingBatch()
    const siblingBefore = processing.orders['ORD-2026-SLB']
    const arrived = recordGoodsArrival(
      processing,
      'VB-2026-010',
      [{ orderId: 'ORD-2026-040', arrivalType: 'FULL' }],
      now,
    )
    const target = arrived.orders['ORD-2026-040']
    const sibling = arrived.orders['ORD-2026-SLB']

    expect(arrived.vendorBatches['VB-2026-010']?.status).toBe('PARTIALLY_ARRIVED')
    expect(target?.stage).toBe('GOODS_ARRIVED')
    expect(target?.goods.arrivalType).toBe('FULL')
    expect(target?.goods.preDeliveryCheckCompleted).toBe(false)
    expect(sibling).toEqual(siblingBefore)
    expect(sibling?.goods.arrivedAt).toBeNull()

    if (!target) throw new Error('Missing arrived order')
    const actions = deriveActionCandidates(
      target,
      { vendorBatch: arrived.vendorBatches['VB-2026-010'] ?? null },
      now,
    )
    expect(derivePrimaryNextAction(actions)?.kind).toBe('CHECK_GOODS')
  })

  it('makes benefit eligible after LUNAS without auto-paying or changing stage', () => {
    const order = canonicalOrder('ORD-2026-040')
    if (order.finalInvoiceAmount === null) throw new Error('Expected finalized invoice')
    const paid = recordSchoolPayment(
      order,
      { amount: order.finalInvoiceAmount, method: 'Transfer bank', evidenceName: 'payment.pdf' },
      now,
    )

    expect(paid.schoolPayment.status).toBe('LUNAS')
    expect(paid.schoolPayment.schoolPaidAmount).toBe(order.finalInvoiceAmount)
    expect(paid.benefit.status).toBe('ELIGIBLE')
    expect(paid.benefit.baseAmount).toBe(order.finalInvoiceAmount)
    expect(paid.benefit.obligationAmount).toBe(1_821_000)
    expect(paid.stage).toBe('SIPLAH')
  })

  it('freezes benefit obligation when LUNAS even if final invoice is later mutated', () => {
    const order = canonicalOrder('ORD-2026-040')
    if (order.finalInvoiceAmount === null) throw new Error('Expected finalized invoice')
    const paid = recordSchoolPayment(
      order,
      { amount: order.finalInvoiceAmount, method: 'Transfer bank', evidenceName: 'payment.pdf' },
      now,
    )
    const frozenAmount = paid.benefit.obligationAmount
    const changedInvoice: Order = {
      ...paid,
      finalInvoiceAmount: order.finalInvoiceAmount + 5_000_000,
    }

    expect(frozenAmount).toBe(1_821_000)
    expect(calculateBenefitAmount(changedInvoice)).toBe(frozenAmount)

    if (frozenAmount === null) throw new Error('Expected frozen benefit')
    const benefitPaid = recordBenefitPayment(
      changedInvoice,
      {
        amount: frozenAmount,
        method: 'Transfer bank',
        recipient: 'Bendahara sekolah',
        proofName: 'benefit.pdf',
      },
      now,
    )
    expect(benefitPaid.benefit.status).toBe('PAID')
    expect(benefitPaid.benefit.baseAmount).toBe(order.finalInvoiceAmount)
    expect(benefitPaid.stage).toBe('SIPLAH')
  })

  it('recomputes primary action after a real benefit transition', () => {
    const order = canonicalOrder('ORD-2026-068')
    const before = deriveActionCandidates(order, { vendorBatch: null }, now)
    expect(derivePrimaryNextAction(before)?.kind).toBe('PAY_BENEFIT')
    const obligationAmount = calculateBenefitAmount(order)
    if (obligationAmount === null) throw new Error('Expected benefit obligation')
    const paid = recordBenefitPayment(
      order,
      {
        amount: obligationAmount,
        method: 'Transfer bank',
        recipient: 'Kepala sekolah',
        proofName: 'benefit.pdf',
      },
      now,
    )
    const after = deriveActionCandidates(paid, { vendorBatch: null }, now)
    expect(derivePrimaryNextAction(after)?.kind).toBe('CLOSE_ORDER')
  })

  it('stores snooze control only for the selected action kind', () => {
    const order = canonicalOrder('ORD-2026-065')
    const snoozed = snoozeOrderAction(
      order,
      'CONTINUE_FULFILLMENT',
      '2026-02-24T08:00:00.000Z',
      now,
    )

    expect(snoozed.nextActionControl.controlsByActionKey).toEqual({
      CONTINUE_FULFILLMENT: { snoozedUntil: '2026-02-24T08:00:00.000Z' },
    })
    expect(snoozed.nextActionControl.controlsByActionKey.PAY_BENEFIT).toBeUndefined()
  })
})
