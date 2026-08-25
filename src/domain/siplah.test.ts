import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import { deriveActionCandidates, derivePrimaryNextAction } from './next-action'
import { isSiplahAdminComplete, isSiplahComplete } from './order-state'
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

describe('SIPLah document completion', () => {
  it('creates all prototype document kinds with explicit requirements', () => {
    const documents = createSiplahDocuments()

    expect(documents.map((document) => document.kind)).toEqual([
      'SURAT_PESANAN',
      'INVOICE',
      'KWITANSI',
      'BAST',
      'SIPLAH_PDF',
    ])
    expect(documents.filter((document) => document.required)).toHaveLength(4)
    expect(documents.find((document) => document.kind === 'SIPLAH_PDF')?.required).toBe(false)
  })

  it('derives admin completion only from order number and required document state', () => {
    const complete = canonicalOrder('ORD-2026-040')
    expect(isSiplahAdminComplete(complete)).toBe(true)

    const missingVerification: Order = {
      ...complete,
      siplah: {
        ...complete.siplah,
        documents: complete.siplah.documents.map((document) =>
          document.kind === 'INVOICE' ? { ...document, verified: false } : document,
        ),
      },
    }
    expect(isSiplahAdminComplete(missingVerification)).toBe(false)
  })

  it('completes checkpoints through explicit transitions and recomputes vendor eligibility action', () => {
    const original = canonicalOrder('ORD-2026-071')
    let order = setSiplahAccessAvailable(original, true)
    order = setSiplahOrderPlaced(order)
    expect(order.siplah.orderPlaced).toBe(true)
    expect(order.siplah.orderNumber).toBeNull()
    order = recordSiplahOrder(order, 'SPL-2026-DEMO-240')

    for (const document of order.siplah.documents.filter((candidate) => candidate.required)) {
      order = attachSiplahDocument(order, document.kind, `${document.kind}-240.pdf`)
      order = verifySiplahDocument(order, document.kind)
      if (document.sendToSchoolRequired) {
        order = sendSiplahDocumentToSchool(order, document.kind)
      }
    }

    expect(isSiplahComplete(order)).toBe(true)
    expect(order.schoolPayment.status).toBe('UNPAID')
    expect(order.benefit.status).toBe('NOT_ELIGIBLE')
    expect(
      derivePrimaryNextAction(
        deriveActionCandidates(order, { vendorBatch: null }, new Date('2026-03-01T08:00:00.000Z')),
      )?.kind,
    ).toBe('ADD_TO_VENDOR_BATCH')
    expect(order.timeline.some((event) => event.title === 'Dokumen SIPLah dikirim')).toBe(true)
  })

  it('keeps SIPLah completion independent from school payment', () => {
    const complete = canonicalOrder('ORD-2026-040')
    const unpaid: Order = {
      ...complete,
      schoolPayment: { ...complete.schoolPayment, status: 'UNPAID', schoolPaidAmount: 0 },
      benefit: {
        ...complete.benefit,
        status: 'NOT_ELIGIBLE',
        baseAmount: null,
        obligationAmount: null,
      },
    }

    expect(isSiplahComplete(unpaid)).toBe(true)
    expect(unpaid.schoolPayment.status).toBe('UNPAID')
    expect(unpaid.benefit.status).toBe('NOT_ELIGIBLE')
  })
})
