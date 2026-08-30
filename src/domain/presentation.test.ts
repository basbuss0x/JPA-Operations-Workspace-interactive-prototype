import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../data/demo-data'
import {
  arrivalTypeLabels,
  benefitStatusLabels,
  getOrderStateItems,
  timelineEventTypeLabels,
  vendorBatchStatusLabels,
} from './presentation'

describe('operator presentation labels', () => {
  it('keeps approved Decision #4 vocabulary separate from canonical enum values', () => {
    expect(vendorBatchStatusLabels.PROCESSING).toBe('Sedang diproses vendor')
    expect(vendorBatchStatusLabels.PARTIALLY_ARRIVED).toBe('Tiba sebagian')
    expect(benefitStatusLabels.ELIGIBLE).toBe('Benefit wajib dibayar')
    expect(benefitStatusLabels.NOT_ELIGIBLE).toBe('Belum wajib dibayar')
    expect(arrivalTypeLabels.NONE).toBe('Belum tiba')
    expect(vendorBatchStatusLabels.RECAP_GENERATED).toBe('Rekap dibuat, belum dikirim')
    expect(timelineEventTypeLabels.SYSTEM).toBe('Otomatis')
    expect(timelineEventTypeLabels.NOTE).toBe('Catatan operator')
  })

  it('uses Belum tiba only in the Barang arrival signal', () => {
    const data = createCanonicalDemoData()
    const order = data.orders['ORD-2026-049']
    if (!order) throw new Error('Missing canonical arrival fixture')

    const states = getOrderStateItems(order, data.vendorBatches['VB-2026-009'] ?? null)
    expect(states.find((state) => state.label === 'Barang')?.value).toBe('Belum tiba')
    expect(states.find((state) => state.label === 'Benefit')?.value).toBe('Belum wajib dibayar')
    expect(states.some((state) => state.value === 'Belum tiba' && state.label !== 'Barang')).toBe(false)
  })
})
