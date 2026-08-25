import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData, DEMO_STATE_VERSION } from '../data/demo-data'
import type { Order } from '../domain/types'
import { migratePrototypeState } from './migrate-prototype-state'

function toLegacyItems(order: Order): Array<Record<string, unknown>> {
  return order.items.map((item) => {
    const legacy = structuredClone(item) as unknown as Record<string, unknown>
    delete legacy.matchConfidence
    delete legacy.matchReason
    delete legacy.resolutionType
    return legacy
  })
}

function legacySiplah(order: Order): Record<string, unknown> {
  const complete = order.siplah.documents.every(
    (document) => !document.required || (
      document.available && document.fileName && document.verified && document.sentToSchool
    ),
  )
  return {
    accessAvailable: order.siplah.accessAvailable,
    orderPlaced: order.siplah.orderPlaced,
    orderNumber: order.siplah.orderNumber,
    suratPesananAvailable: complete,
    suratPesananAttached: complete,
    suratPesananSentToSchool: complete,
    adminCompleted: complete,
  }
}

function toLegacyOrderV1(order: Order): Record<string, unknown> {
  const legacy = structuredClone(order) as unknown as Record<string, unknown>
  legacy.items = toLegacyItems(order)
  legacy.finalInvoiceAmount = order.arkasBudgetAmount
  delete legacy.arkasBudgetAmount
  delete legacy.hetReviewedAmount

  const het = legacy.het as Record<string, unknown>
  het.hetTotalAmount = order.hetReviewedAmount ?? order.arkasBudgetAmount

  legacy.siplah = legacySiplah(order)

  const schoolPayment = legacy.schoolPayment as Record<string, unknown>
  schoolPayment.amount = order.schoolPayment.schoolPaidAmount
  delete schoolPayment.schoolPaidAmount

  const benefit = legacy.benefit as Record<string, unknown>
  delete benefit.baseAmount
  delete benefit.obligationAmount

  legacy.nextActionControl = {
    override: order.nextActionControl.override,
    snoozedUntil: '2026-02-24T08:00:00.000Z',
  }
  return legacy
}

describe('prototype local state migration', () => {
  it('migrates v1 amounts, benefit freeze, SIPLah, and controls into current schema', () => {
    const canonical = createCanonicalDemoData()
    const source = canonical.orders['ORD-2026-068']
    if (!source) throw new Error('Missing source order')
    const legacyOrder = toLegacyOrderV1(source)
    legacyOrder.schoolName = 'Migrated SDN 68'

    const migrated = migratePrototypeState(
      {
        version: 1,
        orders: { [source.id]: legacyOrder },
        vendorBatches: {},
      },
      1,
    )
    const order = migrated.orders[source.id]

    expect(migrated.version).toBe(DEMO_STATE_VERSION)
    expect(order?.schoolName).toBe('Migrated SDN 68')
    expect(order?.arkasBudgetAmount).toBe(24_350_000)
    expect(order?.hetReviewedAmount).toBe(24_350_000)
    expect(order?.finalInvoiceAmount).toBe(24_350_000)
    expect(order?.schoolPayment.schoolPaidAmount).toBe(24_350_000)
    expect(order?.benefit.baseAmount).toBe(24_350_000)
    expect(order?.benefit.obligationAmount).toBe(2_435_000)
    expect(order?.nextActionControl.controlsByActionKey).toEqual({})
    expect(order?.siplah).not.toHaveProperty('adminCompleted')
    expect(order?.siplah.documents).toHaveLength(5)
  })

  it('migrates Gate 1.1 v2 SIPLah booleans and items into document-based schema v3', () => {
    const canonical = createCanonicalDemoData()
    const source = canonical.orders['ORD-2026-040']
    if (!source) throw new Error('Missing source order')
    const legacy = structuredClone(source) as unknown as Record<string, unknown>
    legacy.schoolName = 'Migrated Gate 1.1 School'
    legacy.items = toLegacyItems(source)
    legacy.siplah = legacySiplah(source)

    const migrated = migratePrototypeState(
      { version: 2, orders: { [source.id]: legacy }, vendorBatches: {} },
      2,
    )
    const order = migrated.orders[source.id]

    expect(order?.schoolName).toBe('Migrated Gate 1.1 School')
    expect(order?.siplah.documents.filter((document) => document.required)).toHaveLength(4)
    expect(order?.siplah.documents.every((document) => !document.required || document.verified)).toBe(true)
    expect(order?.items.every((item) => item.matchReason.length > 0)).toBe(true)
  })

  it('resets unknown or malformed schema versions to canonical demo data', () => {
    const migrated = migratePrototypeState(
      { version: 999, orders: {}, vendorBatches: {} },
      999,
    )

    expect(migrated.version).toBe(DEMO_STATE_VERSION)
    expect(Object.keys(migrated.orders)).toHaveLength(9)
    expect(migrated.orders['ORD-2026-030']?.schoolName).toBe('SDN 30 Ambon')
  })
})
