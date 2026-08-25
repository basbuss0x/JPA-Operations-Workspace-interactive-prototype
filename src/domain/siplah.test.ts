import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import { deriveActionCandidates, derivePrimaryNextAction } from './next-action'
import { isSiplahAdminComplete, isSiplahReadyForVendor } from './order-state'
import { createSiplahDocuments } from './siplah'
import {
  attachSiplahDocument,
  recordSiplahOrder,
  sendSiplahDocumentToSchool,
  setSiplahAccessAvailable,
  setSiplahOrderPlaced,
  verifySiplahDocument,
} from './transitions'
import type { Order } from './types'

function canonicalOrder(id: string): Order {
  const order = createCanonicalDemoData().orders[id]
  if (!order) throw new Error(`Missing canonical order ${id}`)
  return order
}

function completeSuratPesanan(order: Order): Order {
  let next = order
  next = attachSiplahDocument(next, 'SURAT_PESANAN', 'SURAT_PESANAN-test.pdf')
  next = verifySiplahDocument(next, 'SURAT_PESANAN')
  return sendSiplahDocumentToSchool(next, 'SURAT_PESANAN')
}

describe('SIPLah lifecycle-aware document requirements', () => {
  it('separates Vendor and admin requirements and only requires Surat Pesanan to be sent', () => {
    const documents = createSiplahDocuments()

    expect(documents.map((document) => document.kind)).toEqual([
      'SURAT_PESANAN',
      'INVOICE',
      'KWITANSI',
      'BAST',
      'SIPLAH_PDF',
    ])
    expect(documents.filter((document) => document.requiredForVendorReady).map((document) => document.kind)).toEqual([
      'SURAT_PESANAN',
    ])
    expect(documents.filter((document) => document.requiredForAdminCompletion)).toHaveLength(4)
    expect(documents.filter((document) => document.sendToSchoolRequired).map((document) => document.kind)).toEqual([
      'SURAT_PESANAN',
    ])
  })

  it('keeps Vendor readiness separate from SIPLah admin completion', () => {
    const vendorReady = canonicalOrder('ORD-2026-040')
    expect(isSiplahReadyForVendor(vendorReady)).toBe(true)
    expect(isSiplahAdminComplete(vendorReady)).toBe(false)

    const adminComplete = canonicalOrder('ORD-2026-068')
    expect(isSiplahReadyForVendor(adminComplete)).toBe(true)
    expect(isSiplahAdminComplete(adminComplete)).toBe(true)
  })

  it.each(['INVOICE', 'KWITANSI', 'BAST'] as const)('does not block Vendor readiness when %s is missing', (kind) => {
    const complete = canonicalOrder('ORD-2026-068')
    const missingLaterDocument: Order = {
      ...complete,
      siplah: {
        ...complete.siplah,
        documents: complete.siplah.documents.map((document) =>
          document.kind === kind
            ? { ...document, available: false, fileName: null, verified: false, sentToSchool: false }
            : document,
        ),
      },
    }

    expect(isSiplahReadyForVendor(missingLaterDocument)).toBe(true)
    expect(isSiplahAdminComplete(missingLaterDocument)).toBe(false)
  })

  it('blocks Vendor readiness when Surat Pesanan is incomplete', () => {
    const complete = canonicalOrder('ORD-2026-068')
    const missingSuratPesanan: Order = {
      ...complete,
      siplah: {
        ...complete.siplah,
        documents: complete.siplah.documents.map((document) =>
          document.kind === 'SURAT_PESANAN'
            ? { ...document, available: false, fileName: null, verified: false, sentToSchool: false }
            : document,
        ),
      },
    }

    expect(isSiplahReadyForVendor(missingSuratPesanan)).toBe(false)
    expect(isSiplahAdminComplete(missingSuratPesanan)).toBe(false)
  })

  it('records the final SIPLah amount explicitly while leaving ARKAS and reviewed HET unchanged', () => {
    const original = canonicalOrder('ORD-2026-071')
    let order = setSiplahAccessAvailable(original, true)
    order = setSiplahOrderPlaced(order)
    const recorded = recordSiplahOrder(order, {
      orderNumber: 'SPL-2026-DEMO-240',
      finalInvoiceAmount: 17_125_000,
    })

    expect(recorded.arkasBudgetAmount).toBe(original.arkasBudgetAmount)
    expect(recorded.hetReviewedAmount).toBe(original.hetReviewedAmount)
    expect(recorded.finalInvoiceAmount).toBe(17_125_000)
    expect(recorded.finalInvoiceAmount).not.toBe(recorded.hetReviewedAmount)
    expect(recorded.timeline[0]?.title).toBe('Transaksi SIPLah dikonfirmasi')
  })

  it('completing only Surat Pesanan unlocks the ADD_TO_VENDOR_BATCH action', () => {
    const original = canonicalOrder('ORD-2026-071')
    let order = setSiplahAccessAvailable(original, true)
    order = setSiplahOrderPlaced(order)
    order = recordSiplahOrder(order, {
      orderNumber: 'SPL-2026-DEMO-240',
      finalInvoiceAmount: 16_500_000,
    })
    order = completeSuratPesanan(order)

    expect(isSiplahReadyForVendor(order)).toBe(true)
    expect(isSiplahAdminComplete(order)).toBe(false)
    expect(order.siplah.documents.find((document) => document.kind === 'INVOICE')?.available).toBe(false)
    expect(
      derivePrimaryNextAction(
        deriveActionCandidates(order, { vendorBatch: null }, new Date('2026-03-01T08:00:00.000Z')),
      )?.kind,
    ).toBe('ADD_TO_VENDOR_BATCH')
  })
})
