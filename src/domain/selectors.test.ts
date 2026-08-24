import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import {
  aggregateVendorItems,
  calculateBenefitAmount,
  deriveWorkQueue,
  getHetExceptionCount,
  isBenefitEligible,
  isCompletionReady,
  isVendorBatchEligible,
} from './selectors'

function canonicalOrder(id: string) {
  const order = createCanonicalDemoData().orders[id]
  if (!order) throw new Error(`Missing canonical order ${id}`)
  return order
}

describe('derived domain selectors', () => {
  it('counts only unresolved HET exceptions', () => {
    expect(getHetExceptionCount(canonicalOrder('ORD-2026-030'))).toBe(2)
    expect(getHetExceptionCount(canonicalOrder('ORD-2026-071'))).toBe(0)
  })

  it('calculates benefit from full final invoice amount', () => {
    const order = canonicalOrder('ORD-2026-068')
    expect(calculateBenefitAmount(order)).toBe(2_435_000)
    expect(isBenefitEligible(order)).toBe(true)
  })

  it('keeps supplier liability outside completion readiness', () => {
    const order = canonicalOrder('ORD-2025-999')
    expect(order.supplierPayment.status).toBe('PARTIAL')
    expect(isCompletionReady(order)).toBe(true)
  })

  it('identifies only fully checked SIPLah orders without batch membership as vendor eligible', () => {
    expect(isVendorBatchEligible(canonicalOrder('ORD-2026-040'))).toBe(true)
    expect(isVendorBatchEligible(canonicalOrder('ORD-2026-SLB'))).toBe(true)
    expect(isVendorBatchEligible(canonicalOrder('ORD-2026-071'))).toBe(false)
    expect(isVendorBatchEligible(canonicalOrder('ORD-2026-049'))).toBe(false)
  })

  it('aggregates vendor quantities while preserving school breakdown', () => {
    const result = aggregateVendorItems([
      canonicalOrder('ORD-2026-040'),
      canonicalOrder('ORD-2026-SLB'),
    ])
    const math = result.find((item) => item.title === 'Matematika Kelas V')
    const bahasa = result.find((item) => item.title === 'Bahasa Indonesia Kelas V')

    expect(math?.totalQuantity).toBe(28)
    expect(math?.schools).toEqual([
      { orderId: 'ORD-2026-040', schoolName: 'SDN 40 Ambon', quantity: 20 },
      { orderId: 'ORD-2026-SLB', schoolName: 'SLB Batu Merah', quantity: 8 },
    ])
    expect(bahasa?.totalQuantity).toBe(21)
  })

  it('groups vendor-ready orders into one actionable work item', () => {
    const data = createCanonicalDemoData()
    const queue = deriveWorkQueue(data, new Date('2026-02-20T08:00:00.000Z'))
    const vendorItem = queue.find((item) => item.kind === 'ADD_TO_VENDOR_BATCH')

    expect(vendorItem?.orderIds).toEqual(['ORD-2026-040', 'ORD-2026-SLB'])
    expect(vendorItem?.title).toBe('2 pesanan siap masuk Vendor Batch')
  })
})
