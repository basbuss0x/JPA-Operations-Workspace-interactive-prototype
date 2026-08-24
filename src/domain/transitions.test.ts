import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import {
  confirmHetReview,
  createVendorBatch,
  recordBenefitPayment,
  recordGoodsArrival,
  recordSchoolPayment,
  resolveHetException,
  transitionVendorBatch,
} from './transitions'
import { deriveNextAction } from './next-action'

const now = new Date('2026-02-21T08:00:00.000Z')

function canonicalOrder(id: string) {
  const order = createCanonicalDemoData().orders[id]
  if (!order) throw new Error(`Missing canonical order ${id}`)
  return order
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
  })

  it('creates a vendor batch as DRAFT and never implies it was sent', () => {
    const data = createCanonicalDemoData()
    const next = createVendorBatch(data, ['ORD-2026-040', 'ORD-2026-SLB'], 'VB-2026-010', now)
    const batch = next.vendorBatches['VB-2026-010']

    expect(batch?.status).toBe('DRAFT')
    expect(batch?.sentAt).toBeNull()
    expect(next.orders['ORD-2026-040']?.vendorBatchId).toBe('VB-2026-010')
    expect(() => transitionVendorBatch(next, 'VB-2026-010', 'SENT_TO_VENDOR', now)).toThrow()

    const recap = transitionVendorBatch(next, 'VB-2026-010', 'RECAP_GENERATED', now)
    const sent = transitionVendorBatch(recap, 'VB-2026-010', 'SENT_TO_VENDOR', now)
    expect(sent.vendorBatches['VB-2026-010']?.sentAt).toBe(now.toISOString())
  })

  it('records goods arrival without implying the goods were checked', () => {
    const data = createCanonicalDemoData()
    const arrived = recordGoodsArrival(data, 'VB-2026-009', 'FULL', now)
    const order = arrived.orders['ORD-2026-049']

    expect(arrived.vendorBatches['VB-2026-009']?.status).toBe('ARRIVED')
    expect(order?.stage).toBe('GOODS_ARRIVED')
    expect(order?.goods.arrivedAt).toBe(now.toISOString())
    expect(order?.goods.preDeliveryCheckCompleted).toBe(false)
    expect(order ? deriveNextAction(order, arrived.vendorBatches['VB-2026-009'] ?? null)?.kind : null).toBe('CHECK_GOODS')
  })

  it('makes benefit eligible after LUNAS but does not auto-pay or close it', () => {
    const order = canonicalOrder('ORD-2026-040')
    const paid = recordSchoolPayment(
      order,
      { amount: order.finalInvoiceAmount, method: 'Transfer bank', evidenceName: 'payment.pdf' },
      now,
    )

    expect(paid.schoolPayment.status).toBe('LUNAS')
    expect(paid.benefit.status).toBe('ELIGIBLE')
    expect(paid.stage).toBe('SIPLAH')

    const benefitPaid = recordBenefitPayment(
      paid,
      {
        amount: Math.round(order.finalInvoiceAmount * 0.1),
        method: 'Transfer bank',
        recipient: 'Bendahara sekolah',
        proofName: 'benefit.pdf',
      },
      now,
    )
    expect(benefitPaid.benefit.status).toBe('PAID')
    expect(benefitPaid.stage).toBe('SIPLAH')
  })

  it('recomputes Next Action after a real state transition', () => {
    const order = canonicalOrder('ORD-2026-068')
    expect(deriveNextAction(order, null)?.kind).toBe('PAY_BENEFIT')
    const paid = recordBenefitPayment(
      order,
      {
        amount: 2_435_000,
        method: 'Transfer bank',
        recipient: 'Kepala sekolah',
        proofName: 'benefit.pdf',
      },
      now,
    )
    expect(deriveNextAction(paid, null)?.kind).toBe('CLOSE_ORDER')
  })
})
