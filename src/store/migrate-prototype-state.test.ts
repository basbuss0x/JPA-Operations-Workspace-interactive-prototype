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
  const suratPesanan = order.siplah.documents.find((document) => document.kind === 'SURAT_PESANAN')
  const complete = Boolean(suratPesanan?.available && suratPesanan.fileName && suratPesanan.verified && suratPesanan.sentToSchool)
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
    const source = canonical.orders['ORD-2026-065']
    if (!source) throw new Error('Missing source order')
    const legacyOrder = toLegacyOrderV1(source)
    legacyOrder.schoolName = 'Migrated SDN 65'

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
    expect(order?.schoolName).toBe('Migrated SDN 65')
    expect(order?.arkasBudgetAmount).toBe(27_640_000)
    expect(order?.hetReviewedAmount).toBe(27_640_000)
    expect(order?.finalInvoiceAmount).toBe(27_640_000)
    expect(order?.schoolPayment.schoolPaidAmount).toBe(27_640_000)
    expect(order?.benefit.baseAmount).toBe(27_640_000)
    expect(order?.benefit.obligationAmount).toBe(2_764_000)
    expect(order?.nextActionControl.controlsByActionKey).toEqual({})
    expect(order?.siplah).not.toHaveProperty('adminCompleted')
    expect(order?.siplah.documents).toHaveLength(5)
    expect(migrated.schools['SCH-999']?.status).toBe('INACTIVE')
  })

  it('migrates Gate 1.1 v2 SIPLah booleans and items into the current lifecycle-aware document schema', () => {
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
    expect(order?.siplah.documents.filter((document) => document.requiredForAdminCompletion)).toHaveLength(4)
    expect(order?.siplah.documents.filter((document) => document.requiredForVendorReady).map((document) => document.kind)).toEqual(['SURAT_PESANAN'])
    expect(order?.siplah.documents.every((document) => !document.requiredForAdminCompletion || document.verified)).toBe(true)
    expect(order?.items.every((item) => item.matchReason.length > 0)).toBe(true)
  })

  it('migrates Gate 2 legacy document flags into separate Vendor/admin requirements', () => {
    const canonical = createCanonicalDemoData()
    const source = canonical.orders['ORD-2026-040']
    if (!source) throw new Error('Missing source order')
    const legacy = structuredClone(source) as unknown as Record<string, unknown>
    legacy.siplah = {
      ...source.siplah,
      documents: source.siplah.documents.map((document) => {
        const legacyDocument = { ...document, required: document.requiredForAdminCompletion } as Record<string, unknown>
        delete legacyDocument.requiredForVendorReady
        delete legacyDocument.requiredForAdminCompletion
        return legacyDocument
      }),
    }

    const migrated = migratePrototypeState(
      { version: 3, orders: { [source.id]: legacy }, vendorBatches: {} },
      3,
    )
    const order = migrated.orders[source.id]
    if (!order) throw new Error('Missing migrated order')

    expect(order.siplah.documents.find((document) => document.kind === 'SURAT_PESANAN')?.requiredForVendorReady).toBe(true)
    expect(order.siplah.documents.find((document) => document.kind === 'INVOICE')?.requiredForVendorReady).toBe(false)
    expect(order.siplah.documents.find((document) => document.kind === 'INVOICE')?.requiredForAdminCompletion).toBe(true)
    expect(order.supplierPayment.obligationAmount).toBeNull()
  })

  it('migrates Pass 2 v4 Vendor Batches with recap lifecycle metadata defaults', () => {
    const canonical = createCanonicalDemoData()
    const sourceOrder = canonical.orders['ORD-2026-049']
    const sourceBatch = canonical.vendorBatches['VB-2026-009']
    if (!sourceOrder || !sourceBatch) throw new Error('Missing Pass 2 source data')
    const legacyBatch = structuredClone(sourceBatch) as unknown as Record<string, unknown>
    delete legacyBatch.recapGeneratedAt
    delete legacyBatch.recapGenerationCount
    delete legacyBatch.confirmedAt
    delete legacyBatch.processingStartedAt
    delete legacyBatch.timeline

    const migrated = migratePrototypeState(
      {
        version: 4,
        orders: { [sourceOrder.id]: sourceOrder },
        vendorBatches: { [sourceBatch.id]: legacyBatch },
      },
      4,
    )
    const batch = migrated.vendorBatches[sourceBatch.id]

    expect(batch?.recapGeneratedAt).toBe(sourceBatch.sentAt)
    expect(batch?.recapGenerationCount).toBe(1)
    expect(batch?.timeline).toEqual([])
    expect(batch?.followUpDueAt).toBeNull()
  })

  it('migrates Pass 3 v5 orders with tracker, settlement, and benefit metadata defaults', () => {
    const canonical = createCanonicalDemoData()
    const source = canonical.orders['ORD-2026-065']
    if (!source) throw new Error('Missing Pass 3 source order')
    const legacy = structuredClone(source) as unknown as Record<string, unknown>
    const goods = legacy.goods as Record<string, unknown>
    const fulfillment = legacy.fulfillment as Record<string, unknown>
    const payment = legacy.schoolPayment as Record<string, unknown>
    const benefit = legacy.benefit as Record<string, unknown>
    delete goods.checkNote
    delete fulfillment.trackerOrderId
    delete fulfillment.trackerUrl
    delete fulfillment.lastSyncAttemptAt
    delete fulfillment.syncMessage
    delete payment.deductionAmount
    delete payment.netReceivedAmount
    delete benefit.recipientType
    delete benefit.accountReference
    delete benefit.schoolConfirmedAt

    const migrated = migratePrototypeState(
      { version: 5, orders: { [source.id]: legacy }, vendorBatches: {} },
      5,
    )
    const order = migrated.orders[source.id]

    expect(migrated.version).toBe(DEMO_STATE_VERSION)
    expect(order?.fulfillment.trackerOrderId).toBe('KBT-2026-065')
    expect(order?.fulfillment.remainingQty).toBe(67)
    expect(order?.schoolPayment.deductionAmount).toBe(0)
    expect(order?.schoolPayment.netReceivedAmount).toBe(27_640_000)
    expect(order?.benefit.recipientType).toBeNull()
    expect(order?.benefit.schoolConfirmedAt).toBeNull()
  })

  it('migrates v6 state into an explicit school registry without inferring CLOSED as inactive', () => {
    const canonical = createCanonicalDemoData()
    const source = canonical.orders['ORD-2025-999']
    if (!source) throw new Error('Missing closed source order')

    const migrated = migratePrototypeState(
      { version: 6, orders: { [source.id]: source }, vendorBatches: {} },
      6,
    )

    expect(migrated.version).toBe(DEMO_STATE_VERSION)
    expect(migrated.schools[source.schoolId]).toMatchObject({
      id: source.schoolId,
      name: source.schoolName,
      status: 'INACTIVE',
    })
    expect(migrated.orders[source.id]?.schoolId).toBe(source.schoolId)
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
