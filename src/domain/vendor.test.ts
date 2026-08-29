import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import { deriveActionCandidates } from './next-action'
import {
  aggregateVendorItems,
  buildVendorRecap,
  deriveWorkQueue,
  isVendorBatchEligible,
  proposeVendorBatchId,
} from './selectors'
import {
  createVendorBatch,
  generateVendorRecap,
  recordGoodsArrival,
  setVendorFollowUpReminder,
  transitionVendorBatch,
} from './transitions'
import type { Order, PrototypeData } from './types'

const now = new Date('2026-02-21T08:00:00.000Z')

function order(data: PrototypeData, id: string): Order {
  const found = data.orders[id]
  if (!found) throw new Error(`Missing order ${id}`)
  return found
}

function processingBatch(): PrototypeData {
  const data = createVendorBatch(
    createCanonicalDemoData(),
    ['ORD-2026-040', 'ORD-2026-SLB'],
    'VB-2026-010',
    now,
  )
  const recap = generateVendorRecap(data, 'VB-2026-010', now)
  const sent = transitionVendorBatch(recap, 'VB-2026-010', 'SENT_TO_VENDOR', now)
  const confirmed = transitionVendorBatch(sent, 'VB-2026-010', 'VENDOR_CONFIRMED', now)
  return transitionVendorBatch(confirmed, 'VB-2026-010', 'PROCESSING', now)
}

describe('Vendor Batch domain', () => {
  it('requires every existing Vendor eligibility checkpoint including final invoice', () => {
    const data = createCanonicalDemoData()
    const eligible = order(data, 'ORD-2026-040')
    expect(isVendorBatchEligible(eligible)).toBe(true)
    expect(isVendorBatchEligible({ ...eligible, finalInvoiceAmount: null })).toBe(false)
    expect(isVendorBatchEligible({ ...eligible, het: { ...eligible.het, status: 'NEEDS_REVIEW' } })).toBe(false)
    expect(isVendorBatchEligible({
      ...eligible,
      items: eligible.items.map((item, index) => index === 0 ? { ...item, matchStatus: 'NO_MATCH' } : item),
    })).toBe(false)
    expect(isVendorBatchEligible({ ...eligible, stage: 'CLOSED' })).toBe(false)
    expect(isVendorBatchEligible({ ...eligible, vendorBatchId: 'VB-OTHER' })).toBe(false)
  })

  it('uses a deterministic collision-free next batch identity', () => {
    expect(proposeVendorBatchId(createCanonicalDemoData().vendorBatches)).toBe('VB-2026-010')
  })

  it('recalculates totals when an order is selected or removed', () => {
    const data = createCanonicalDemoData()
    const both = buildVendorRecap([order(data, 'ORD-2026-040'), order(data, 'ORD-2026-SLB')])
    const one = buildVendorRecap([order(data, 'ORD-2026-040')])

    expect(both.aggregatedItems.find((item) => item.productCode === 'BK-MTK-5')?.totalQuantity).toBe(28)
    expect(one.aggregatedItems.find((item) => item.productCode === 'BK-MTK-5')?.totalQuantity).toBe(20)
    expect(both.totalQuantity).toBe(69)
    expect(one.totalQuantity).toBe(55)
  })

  it('aggregates duplicate product identity rather than display title', () => {
    const data = createCanonicalDemoData()
    const slb = order(data, 'ORD-2026-SLB')
    const altered: Order = {
      ...slb,
      items: slb.items.map((item) => item.productCode === 'BK-MTK-5'
        ? { ...item, arkasTitle: 'Display title berbeda', masterProductTitle: 'Judul salinan lama' }
        : item),
    }
    const aggregate = aggregateVendorItems([order(data, 'ORD-2026-040'), altered])
    const math = aggregate.find((item) => item.productCode === 'BK-MTK-5')

    expect(math?.totalQuantity).toBe(28)
    expect(math?.title).toBe('Matematika untuk SD/MI Kelas V')
    expect(math?.schools).toHaveLength(2)
  })

  it('preserves exact school allocation from the same OrderItem source', () => {
    const data = createCanonicalDemoData()
    const recap = buildVendorRecap([order(data, 'ORD-2026-040'), order(data, 'ORD-2026-SLB')])
    expect(recap.schoolBreakdown.find((school) => school.orderId === 'ORD-2026-040')?.items).toEqual([
      { productCode: 'BK-BINDO-5', title: 'Bahasa Indonesia Kelas V', quantity: 15 },
      { productCode: 'BK-IPAS-5', title: 'IPAS Kelas V', quantity: 20 },
      { productCode: 'BK-MTK-5', title: 'Matematika untuk SD/MI Kelas V', quantity: 20 },
    ])
    expect(recap.schoolBreakdown.find((school) => school.orderId === 'ORD-2026-SLB')?.items).toEqual([
      { productCode: 'BK-BINDO-5', title: 'Bahasa Indonesia Kelas V', quantity: 6 },
      { productCode: 'BK-MTK-5', title: 'Matematika untuk SD/MI Kelas V', quantity: 8 },
    ])
  })

  it('fails safely for an invalid unmapped product', () => {
    const data = createCanonicalDemoData()
    const source = order(data, 'ORD-2026-040')
    const invalid: Order = {
      ...source,
      items: source.items.map((item, index) => index === 0
        ? { ...item, productCode: null, masterProductTitle: null }
        : item),
    }
    expect(() => buildVendorRecap([invalid])).toThrow(/belum dipetakan ke Product Master/)
  })

  it('creates only DRAFT membership and rejects a second active batch', () => {
    const created = createVendorBatch(
      createCanonicalDemoData(),
      ['ORD-2026-040', 'ORD-2026-SLB'],
      'VB-2026-010',
      now,
    )
    const batch = created.vendorBatches['VB-2026-010']

    expect(batch?.status).toBe('DRAFT')
    expect(batch?.recapGeneratedAt).toBeNull()
    expect(batch?.sentAt).toBeNull()
    expect(order(created, 'ORD-2026-040').vendorBatchId).toBe('VB-2026-010')
    expect(order(created, 'ORD-2026-SLB').vendorBatchId).toBe('VB-2026-010')
    expect(() => createVendorBatch(created, ['ORD-2026-040'], 'VB-2026-011', now)).toThrow(/sudah menjadi anggota/)
  })

  it('generates recap only to RECAP_GENERATED and never infers sent', () => {
    const draft = createVendorBatch(createCanonicalDemoData(), ['ORD-2026-040'], 'VB-2026-010', now)
    const generated = generateVendorRecap(draft, 'VB-2026-010', now)
    const batch = generated.vendorBatches['VB-2026-010']

    expect(batch?.status).toBe('RECAP_GENERATED')
    expect(batch?.recapGeneratedAt).toBe(now.toISOString())
    expect(batch?.recapGenerationCount).toBe(1)
    expect(batch?.sentAt).toBeNull()
    const regenerated = generateVendorRecap(generated, 'VB-2026-010', new Date('2026-02-22T08:00:00.000Z'))
    expect(regenerated.vendorBatches['VB-2026-010']?.status).toBe('RECAP_GENERATED')
    expect(regenerated.vendorBatches['VB-2026-010']?.recapGenerationCount).toBe(2)
  })

  it('allows SENT_TO_VENDOR only from RECAP_GENERATED and rejects illegal skips', () => {
    const draft = createVendorBatch(createCanonicalDemoData(), ['ORD-2026-040'], 'VB-2026-010', now)
    expect(() => transitionVendorBatch(draft, 'VB-2026-010', 'SENT_TO_VENDOR', now)).toThrow(/tidak diizinkan/)
    const generated = generateVendorRecap(draft, 'VB-2026-010', now)
    const sent = transitionVendorBatch(generated, 'VB-2026-010', 'SENT_TO_VENDOR', now)
    expect(sent.vendorBatches['VB-2026-010']?.sentAt).toBe(now.toISOString())
    expect(() => transitionVendorBatch(sent, 'VB-2026-010', 'PROCESSING', now)).toThrow(/tidak diizinkan/)
  })

  it('rejects generic arrival transitions so allocations remain the only arrival source', () => {
    const processing = processingBatch()
    expect(() => transitionVendorBatch(processing, 'VB-2026-010', 'ARRIVED', now)).toThrow(/recordGoodsArrival/)
    expect(() => transitionVendorBatch(processing, 'VB-2026-010', 'PARTIALLY_ARRIVED', now)).toThrow(/recordGoodsArrival/)

    const partial = recordGoodsArrival(
      processing,
      'VB-2026-010',
      [{ orderId: 'ORD-2026-040', arrivalType: 'PARTIAL' }],
      now,
    )
    expect(() => transitionVendorBatch(partial, 'VB-2026-010', 'ARRIVED', now)).toThrow(/recordGoodsArrival/)
  })

  it('keeps future reminders passive and exposes one reached reminder candidate per order', () => {
    const processing = processingBatch()
    const future = setVendorFollowUpReminder(processing, 'VB-2026-010', '2026-02-25T08:00:00.000Z', now)
    const futureBatch = future.vendorBatches['VB-2026-010']
    expect(deriveActionCandidates(order(future, 'ORD-2026-040'), { vendorBatch: futureBatch ?? null }, now)
      .some((action) => action.kind === 'FOLLOW_UP_VENDOR')).toBe(false)

    const reached = setVendorFollowUpReminder(future, 'VB-2026-010', now.toISOString(), now)
    const reachedBatch = reached.vendorBatches['VB-2026-010']
    expect(deriveActionCandidates(order(reached, 'ORD-2026-040'), { vendorBatch: reachedBatch ?? null }, now)
      .some((action) => action.kind === 'FOLLOW_UP_VENDOR')).toBe(true)
  })

  it('groups one reached batch reminder instead of duplicating it for every school', () => {
    const processing = processingBatch()
    const reached = setVendorFollowUpReminder(processing, 'VB-2026-010', now.toISOString(), now)
    const reminders = deriveWorkQueue(reached, now).filter((item) => item.kind === 'FOLLOW_UP_VENDOR')

    expect(reminders).toHaveLength(1)
    expect(reminders[0]?.href).toBe('/vendor-batches/VB-2026-010')
    expect(reminders[0]?.orderIds).toEqual(['ORD-2026-040', 'ORD-2026-SLB'])
  })

  it('exposes one non-snoozable setup obligation for an unscheduled processing batch', () => {
    const processing = processingBatch()
    const setup = deriveWorkQueue(processing, now).filter(
      (item) => item.kind === 'SCHEDULE_VENDOR_FOLLOW_UP' && item.id.includes('VB-2026-010'),
    )

    expect(setup).toHaveLength(1)
    expect(setup[0]?.id).toBe('queue-schedule-vendor-VB-2026-010')
    expect(setup[0]?.orderIds).toEqual(['ORD-2026-040', 'ORD-2026-SLB'])
    expect(setup[0]?.snoozable).toBe(false)
    expect(setup[0]?.dueAt).toBeNull()
  })

  it('targets partial arrival and derives ARRIVED only after every member order is FULL', () => {
    const processing = processingBatch()
    const siblingBefore = order(processing, 'ORD-2026-SLB')
    const partial = recordGoodsArrival(
      processing,
      'VB-2026-010',
      [{ orderId: 'ORD-2026-040', arrivalType: 'PARTIAL' }],
      now,
    )
    expect(partial.vendorBatches['VB-2026-010']?.status).toBe('PARTIALLY_ARRIVED')
    expect(order(partial, 'ORD-2026-040').goods.arrivalType).toBe('PARTIAL')
    expect(order(partial, 'ORD-2026-SLB')).toEqual(siblingBefore)

    const full = recordGoodsArrival(
      partial,
      'VB-2026-010',
      [
        { orderId: 'ORD-2026-040', arrivalType: 'FULL' },
        { orderId: 'ORD-2026-SLB', arrivalType: 'FULL' },
      ],
      now,
    )
    expect(full.vendorBatches['VB-2026-010']?.status).toBe('ARRIVED')
    expect(full.vendorBatches['VB-2026-010']?.arrivedAt).toBe(now.toISOString())
  })
})
