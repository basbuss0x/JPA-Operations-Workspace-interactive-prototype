import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData, DEMO_STATE_VERSION } from '../data/demo-data'
import type { Order } from '../domain/types'
import { migratePrototypeState } from './migrate-prototype-state'

function toLegacyOrderV1(order: Order): Record<string, unknown> {
  const legacy = structuredClone(order) as unknown as Record<string, unknown>
  legacy.finalInvoiceAmount = order.arkasBudgetAmount
  delete legacy.arkasBudgetAmount
  delete legacy.hetReviewedAmount

  const het = legacy.het as Record<string, unknown>
  het.hetTotalAmount = order.hetReviewedAmount ?? order.arkasBudgetAmount

  const siplah = legacy.siplah as Record<string, unknown>
  siplah.adminCompleted = true

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
  it('migrates v1 amounts, benefit freeze, SIPLah, and controls into schema v2', () => {
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
