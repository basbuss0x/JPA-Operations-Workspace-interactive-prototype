import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import {
  deriveActionCandidates,
  derivePrimaryNextAction,
  getActiveActionCandidates,
} from './next-action'
import { getOrderBatch } from './selectors'
import type { NextActionKind, Order } from './types'

const now = new Date('2026-02-21T08:00:00.000Z')

function canonicalOrder(id: string): Order {
  const order = createCanonicalDemoData().orders[id]
  if (!order) throw new Error(`Missing canonical order ${id}`)
  return order
}

function candidatesFor(order: Order, nowValue = now) {
  const data = createCanonicalDemoData()
  return deriveActionCandidates(
    order,
    { vendorBatch: getOrderBatch(order, data.vendorBatches) },
    nowValue,
  )
}

const expectedPrimaryKinds: Record<string, NextActionKind | null> = {
  'ORD-2026-030': 'REVIEW_HET',
  'ORD-2026-071': 'COMPLETE_SIPLAH',
  'ORD-2026-040': 'ADD_TO_VENDOR_BATCH',
  'ORD-2026-SLB': 'ADD_TO_VENDOR_BATCH',
  'ORD-2026-049': null,
  'ORD-2026-239': 'CHECK_GOODS',
  'ORD-2026-065': 'CONTINUE_FULFILLMENT',
  'ORD-2026-068': null,
  'ORD-2025-999': null,
}

describe('Next Action candidate engine', () => {
  it('derives deterministic primary actions for every canonical scenario', () => {
    const data = createCanonicalDemoData()
    for (const [orderId, expectedKind] of Object.entries(expectedPrimaryKinds)) {
      const order = data.orders[orderId]
      if (!order) throw new Error(`Missing canonical order ${orderId}`)
      const candidates = deriveActionCandidates(
        order,
        { vendorBatch: getOrderBatch(order, data.vendorBatches) },
        now,
      )
      expect(derivePrimaryNextAction(candidates)?.kind ?? null, orderId).toBe(expectedKind)
    }
  })

  it('keeps simultaneous fulfillment and benefit obligations representable', () => {
    const original = canonicalOrder('ORD-2026-065')
    const order: Order = {
      ...original,
      benefit: {
        ...original.benefit,
        status: 'ELIGIBLE',
        baseAmount: original.finalInvoiceAmount,
        obligationAmount: 2_764_000,
        paidAt: null,
      },
    }

    const candidates = candidatesFor(order)
    expect(getActiveActionCandidates(candidates).map((action) => action.kind)).toEqual([
      'CONTINUE_FULFILLMENT',
      'PAY_BENEFIT',
    ])
    expect(derivePrimaryNextAction(candidates)?.kind).toBe('CONTINUE_FULFILLMENT')
  })

  it('pins a manual action without erasing system obligations', () => {
    const original = canonicalOrder('ORD-2026-030')
    const order: Order = {
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

    const candidates = candidatesFor(order)
    expect(candidates.map((action) => action.kind)).toEqual(['MANUAL', 'REVIEW_HET'])
    expect(derivePrimaryNextAction(candidates)?.kind).toBe('MANUAL')
    expect(order.het.status).toBe('NEEDS_REVIEW')
  })

  it('snoozes one action kind without hiding another action on the same order', () => {
    const original = canonicalOrder('ORD-2026-065')
    const order: Order = {
      ...original,
      benefit: {
        ...original.benefit,
        status: 'ELIGIBLE',
        baseAmount: original.finalInvoiceAmount,
        obligationAmount: 2_764_000,
        paidAt: null,
      },
      nextActionControl: {
        ...original.nextActionControl,
        controlsByActionKey: {
          CONTINUE_FULFILLMENT: { snoozedUntil: '2026-02-24T08:00:00.000Z' },
        },
      },
    }

    const candidates = candidatesFor(order)
    expect(candidates.find((action) => action.kind === 'CONTINUE_FULFILLMENT')?.availability).toBe('SNOOZED')
    expect(getActiveActionCandidates(candidates).map((action) => action.kind)).toEqual(['PAY_BENEFIT'])
    expect(derivePrimaryNextAction(candidates)?.kind).toBe('PAY_BENEFIT')
  })

  it('activates payment follow-up only when its due date is reached', () => {
    const original = canonicalOrder('ORD-2026-040')
    const futureReminder: Order = {
      ...original,
      schoolPayment: {
        ...original.schoolPayment,
        followUpDueAt: '2026-02-25T08:00:00.000Z',
      },
    }
    expect(candidatesFor(futureReminder).some((action) => action.kind === 'FOLLOW_UP_PAYMENT')).toBe(false)

    const reachedReminder: Order = {
      ...futureReminder,
      schoolPayment: {
        ...futureReminder.schoolPayment,
        followUpDueAt: '2026-02-21T08:00:00.000Z',
      },
    }
    expect(candidatesFor(reachedReminder).some((action) => action.kind === 'FOLLOW_UP_PAYMENT')).toBe(true)
  })

  it('keeps PROCESSING passive unless an explicit vendor reminder is reached', () => {
    const data = createCanonicalDemoData()
    const order = canonicalOrder('ORD-2026-049')
    const batch = data.vendorBatches['VB-2026-009']
    if (!batch) throw new Error('Missing vendor batch')

    expect(deriveActionCandidates(order, { vendorBatch: batch }, now)).toEqual([])
    expect(
      deriveActionCandidates(
        order,
        { vendorBatch: { ...batch, followUpDueAt: '2026-02-25T08:00:00.000Z' } },
        now,
      ).some((action) => action.kind === 'FOLLOW_UP_VENDOR'),
    ).toBe(false)
    expect(
      deriveActionCandidates(
        order,
        { vendorBatch: { ...batch, followUpDueAt: '2026-02-21T08:00:00.000Z' } },
        now,
      ).some((action) => action.kind === 'FOLLOW_UP_VENDOR'),
    ).toBe(true)
  })
})
