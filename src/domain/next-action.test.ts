import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import { deriveNextAction } from './next-action'
import { getOrderBatch } from './selectors'

const expectedKinds: Record<string, string | null> = {
  'ORD-2026-030': 'REVIEW_HET',
  'ORD-2026-071': 'COMPLETE_SIPLAH',
  'ORD-2026-040': 'ADD_TO_VENDOR_BATCH',
  'ORD-2026-SLB': 'ADD_TO_VENDOR_BATCH',
  'ORD-2026-049': 'FOLLOW_UP_VENDOR',
  'ORD-2026-239': 'CHECK_GOODS',
  'ORD-2026-065': 'CONTINUE_FULFILLMENT',
  'ORD-2026-068': 'PAY_BENEFIT',
  'ORD-2025-999': null,
}

describe('Next Action engine', () => {
  it('derives deterministic actions for every canonical scenario', () => {
    const data = createCanonicalDemoData()
    for (const [orderId, expectedKind] of Object.entries(expectedKinds)) {
      const order = data.orders[orderId]
      if (!order) throw new Error(`Missing canonical order ${orderId}`)
      const action = deriveNextAction(order, getOrderBatch(order, data.vendorBatches))
      expect(action?.kind ?? null, orderId).toBe(expectedKind)
    }
  })

  it('uses manual override without mutating underlying workflow state', () => {
    const data = createCanonicalDemoData()
    const original = data.orders['ORD-2026-030']
    if (!original) throw new Error('Missing order')
    const order = {
      ...original,
      nextActionControl: {
        ...original.nextActionControl,
        override: {
          title: 'Konfirmasi harga dengan sekolah',
          reason: 'Sekolah sedang rapat BOS.',
          dueAt: '2026-02-24T08:00:00.000Z',
          createdAt: '2026-02-20T08:00:00.000Z',
        },
      },
    }

    const action = deriveNextAction(order, null)
    expect(action?.kind).toBe('MANUAL')
    expect(action?.title).toBe('Konfirmasi harga dengan sekolah')
    expect(order.het.status).toBe('NEEDS_REVIEW')
  })
})
