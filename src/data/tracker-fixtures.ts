import type { FulfillmentRefreshResult, Order } from '../domain/types'

const SUCCESS_SNAPSHOTS: Record<string, { deliveredQty: number; problemCount: number }> = {
  'KBT-2026-239': { deliveredQty: 120, problemCount: 1 },
  'KBT-2026-065': { deliveredQty: 247, problemCount: 4 },
  'KBT-2026-068': { deliveredQty: 275, problemCount: 0 },
  'KBT-2025-999': { deliveredQty: 200, problemCount: 0 },
}

export type MockTrackerOutcome = 'SUCCESS' | 'STALE' | 'ERROR'

export function getMockTrackerRefresh(
  order: Pick<Order, 'fulfillment'>,
  outcome: MockTrackerOutcome,
): FulfillmentRefreshResult {
  if (outcome === 'STALE') {
    return { status: 'STALE', message: 'Tracker belum memiliki snapshot yang lebih baru.' }
  }
  if (outcome === 'ERROR') {
    return { status: 'ERROR', message: 'Simulasi koneksi tracker gagal. Cache terakhir tetap digunakan.' }
  }
  const snapshot = SUCCESS_SNAPSHOTS[order.fulfillment.trackerOrderId]
  return {
    status: 'OK',
    deliveredQty: snapshot?.deliveredQty ?? order.fulfillment.deliveredQty,
    problemCount: snapshot?.problemCount ?? order.fulfillment.problemCount,
  }
}
