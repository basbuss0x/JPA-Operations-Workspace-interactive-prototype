import { describe, expect, it } from 'vitest'
import { extractArkasFixture, DEMO_ARKAS_FIXTURE } from '../data/arkas-fixtures'
import { createCanonicalDemoData } from '../data/demo-data'
import { PRODUCT_MASTER } from '../data/product-master'
import { deriveActionCandidates, derivePrimaryNextAction } from './next-action'
import { calculateArkasBudgetAmount, matchExtractedItems } from './intake'
import {
  acceptSuggestedHetMatch,
  calculateReviewedHetAmount,
  chooseHetProduct,
  confirmHetReview,
  createOrderFromExtraction,
  manualOverrideHetItem,
  reopenHetReview,
} from './transitions'

const now = new Date('2026-03-01T08:00:00.000Z')

function createExtractedOrder() {
  const extraction = extractArkasFixture(DEMO_ARKAS_FIXTURE.id)
  return createOrderFromExtraction(
    {
      id: 'ORD-2026-240',
      schoolId: 'SCH-DEMO-BARU',
      schoolName: 'SD Demo Baru',
      sourceType: 'PDF',
      fileName: DEMO_ARKAS_FIXTURE.fileName,
      extraction,
      matchedItems: matchExtractedItems(extraction.lines, PRODUCT_MASTER),
    },
    now,
  )
}

describe('HET exception review and approval', () => {
  it('creates an extracted order while preserving immutable ARKAS source values', () => {
    const extraction = extractArkasFixture(DEMO_ARKAS_FIXTURE.id)
    const order = createExtractedOrder()
    const sourceMath = extraction.lines.find((line) => line.id === 'line-mtk-5')
    const orderMath = order.items.find((item) => item.id === 'line-mtk-5')

    expect(order.stage).toBe('HET_REVIEW')
    expect(order.het.status).toBe('NEEDS_REVIEW')
    expect(order.arkasBudgetAmount).toBe(8_072_000)
    expect(order.arkasBudgetAmount).toBe(calculateArkasBudgetAmount(extraction.lines))
    expect(order.hetReviewedAmount).toBeNull()
    expect(order.finalInvoiceAmount).toBeNull()
    expect(order.supplierPayment.status).toBe('NOT_SET')
    expect(order.supplierPayment.obligationAmount).toBeNull()
    expect(order.supplierPayment.paidAmount).toBe(0)
    expect(orderMath?.arkasTitle).toBe(sourceMath?.arkasTitle)
    expect(orderMath?.arkasUnitPrice).toBe(sourceMath?.arkasUnitPrice)
    expect(orderMath?.quantity).toBe(sourceMath?.quantity)
  })

  it('requires every exception resolution and an explicit confirmation gate', () => {
    const order = createExtractedOrder()
    expect(() => confirmHetReview(order, now)).toThrow(/exception/)

    const priceAccepted = acceptSuggestedHetMatch(order, 'line-mtk-5', now)
    const pai = PRODUCT_MASTER.find((product) => product.code === 'BK-PAI-5')
    if (!pai) throw new Error('Missing PAI fixture')
    const productChosen = chooseHetProduct(priceAccepted, 'line-pendidikan-agama', pai, now)
    const allResolved = manualOverrideHetItem(
      productChosen,
      'line-muatan-lokal',
      { reviewedUnitPrice: 55_000, reason: 'Gunakan harga ARKAS untuk produk lokal non-master.' },
      now,
    )

    expect(allResolved.het.status).toBe('NEEDS_REVIEW')
    expect(allResolved.items.find((item) => item.id === 'line-mtk-5')?.arkasUnitPrice).toBe(78_000)
    expect(calculateReviewedHetAmount(allResolved.items)).toBe(8_188_000)

    const approved = confirmHetReview(allResolved, now)
    expect(approved.het.status).toBe('APPROVED')
    expect(approved.stage).toBe('SIPLAH')
    expect(approved.arkasBudgetAmount).toBe(8_072_000)
    expect(approved.hetReviewedAmount).toBe(8_188_000)
    expect(approved.finalInvoiceAmount).toBeNull()
    expect(approved.timeline[0]?.title).toBe('HET disetujui')
    expect(approved.timeline[0]?.detail).toContain('Review HET dikonfirmasi')
    expect(approved.timeline[0]?.detail).not.toContain('invoice final ditetapkan')
    expect(
      derivePrimaryNextAction(
        deriveActionCandidates(approved, { vendorBatch: null }, now),
      )?.kind,
    ).toBe('COMPLETE_SIPLAH')
  })

  it('requires a reason for manual override', () => {
    const order = createExtractedOrder()
    expect(() =>
      manualOverrideHetItem(
        order,
        'line-muatan-lokal',
        { reviewedUnitPrice: 55_000, reason: '  ' },
        now,
      ),
    ).toThrow(/alasan/)
  })

  it('reopens approved HET before SIPLah ordering and preserves approval history', () => {
    const original = createCanonicalDemoData().orders['ORD-2026-071']
    if (!original) throw new Error('Missing canonical order')
    const reopened = reopenHetReview(original, 'Sekolah mengirim koreksi harga ARKAS.', now)

    expect(reopened.stage).toBe('HET_REVIEW')
    expect(reopened.het.status).toBe('NEEDS_REVIEW')
    expect(reopened.het.approvedAt).toBeNull()
    expect(reopened.hetReviewedAmount).toBeNull()
    expect(reopened.finalInvoiceAmount).toBeNull()
    expect(reopened.arkasBudgetAmount).toBe(original.arkasBudgetAmount)
    expect(reopened.timeline[0]?.title).toBe('Review HET dibuka kembali')
    expect(reopened.timeline[0]?.detail).toContain('Sekolah mengirim koreksi harga ARKAS.')

    const reapproved = confirmHetReview(reopened, new Date('2026-03-02T08:00:00.000Z'))
    expect(reapproved.het.status).toBe('APPROVED')
    expect(reapproved.hetReviewedAmount).toBe(calculateReviewedHetAmount(original.items))
    expect(reapproved.finalInvoiceAmount).toBeNull()
    expect(reapproved.timeline.filter((event) => event.title === 'HET disetujui')).toHaveLength(2)
    expect(reapproved.timeline.some((event) => event.title === 'Review HET dibuka kembali')).toBe(true)
  })

  it('requires a reason and blocks direct reopen after SIPLah order placement', () => {
    const notPlaced = createCanonicalDemoData().orders['ORD-2026-071']
    const placed = createCanonicalDemoData().orders['ORD-2026-040']
    if (!notPlaced || !placed) throw new Error('Missing canonical order')

    expect(() => reopenHetReview(notPlaced, '  ', now)).toThrow(/Alasan/)
    expect(() => reopenHetReview(placed, 'Harga berubah.', now)).toThrow(/koreksi|pembatalan/)
  })
})
