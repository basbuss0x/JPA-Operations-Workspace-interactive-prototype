import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import {
  aggregateVendorItems,
  calculateBenefitAmount,
  deriveWorkQueue,
  getHetExceptionCount,
  isBenefitEligible,
  isCompletionReady,
  isSiplahAdminComplete,
  isSiplahComplete,
  isVendorBatchEligible,
} from './selectors'
import type { Order } from './types'

const now = new Date('2026-02-20T08:00:00.000Z')

function canonicalOrder(id: string): Order {
  const order = createCanonicalDemoData().orders[id]
  if (!order) throw new Error(`Missing canonical order ${id}`)
  return order
}

describe('derived domain selectors', () => {
  it('counts only unresolved HET exceptions', () => {
    expect(getHetExceptionCount(canonicalOrder('ORD-2026-030'))).toBe(2)
    expect(getHetExceptionCount(canonicalOrder('ORD-2026-071'))).toBe(0)
  })

  it('keeps ARKAS, HET-reviewed, final invoice, and school-paid amounts separate', () => {
    const reviewOrder = canonicalOrder('ORD-2026-030')
    const paidOrder = canonicalOrder('ORD-2026-068')

    expect(reviewOrder.arkasBudgetAmount).toBe(18_940_000)
    expect(reviewOrder.hetReviewedAmount).toBe(19_360_000)
    expect(reviewOrder.finalInvoiceAmount).toBeNull()
    expect(paidOrder.finalInvoiceAmount).toBe(24_350_000)
    expect(paidOrder.schoolPayment.schoolPaidAmount).toBe(24_350_000)
  })

  it('uses a frozen benefit obligation after school payment is LUNAS', () => {
    const order = canonicalOrder('ORD-2026-068')
    expect(order.benefit.baseAmount).toBe(24_350_000)
    expect(calculateBenefitAmount(order)).toBe(2_435_000)
    expect(isBenefitEligible(order)).toBe(true)
  })

  it('derives SIPLah admin completion from order and required document checkpoints', () => {
    const complete = canonicalOrder('ORD-2026-040')
    expect(isSiplahAdminComplete(complete)).toBe(true)
    expect(isSiplahComplete(complete)).toBe(true)

    const missingAttachment: Order = {
      ...complete,
      siplah: {
        ...complete.siplah,
        documents: complete.siplah.documents.map((document) =>
          document.kind === 'SURAT_PESANAN'
            ? { ...document, available: false, fileName: null }
            : document,
        ),
      },
    }
    expect(isSiplahAdminComplete(missingAttachment)).toBe(false)
    expect(isSiplahComplete(missingAttachment)).toBe(false)
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

  it('groups vendor-ready orders and omits passive PROCESSING batches from Work Queue', () => {
    const data = createCanonicalDemoData()
    const queue = deriveWorkQueue(data, now)
    const vendorItem = queue.find((item) => item.kind === 'ADD_TO_VENDOR_BATCH')

    expect(vendorItem?.orderIds).toEqual(['ORD-2026-040', 'ORD-2026-SLB'])
    expect(vendorItem?.title).toBe('2 pesanan siap masuk Vendor Batch')
    expect(queue.some((item) => item.kind === 'FOLLOW_UP_VENDOR')).toBe(false)
  })
})
