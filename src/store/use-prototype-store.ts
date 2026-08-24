import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createCanonicalDemoData, DEMO_STATE_VERSION } from '../data/demo-data'
import {
  addTimelineNote,
  setNextActionOverride,
  snoozeOrderAction,
} from '../domain/transitions'
import type { NextActionKind, NextActionOverride, Order, PrototypeData } from '../domain/types'
import { migratePrototypeState } from './migrate-prototype-state'

interface PrototypeStore extends PrototypeData {
  resetDemoData: () => void
  snoozeNextAction: (
    orderIds: string[],
    actionKind: NextActionKind,
    until: string | null,
  ) => void
  saveNextActionOverride: (
    orderId: string,
    override: Omit<NextActionOverride, 'createdAt'> | null,
  ) => void
  addNote: (orderId: string, note: string) => void
}

function updateOrders(
  orders: Record<string, Order>,
  orderIds: string[],
  update: (order: Order) => Order,
): Record<string, Order> {
  const next = { ...orders }
  for (const orderId of orderIds) {
    const order = next[orderId]
    if (order) next[orderId] = update(order)
  }
  return next
}

const initialData = createCanonicalDemoData()

export const usePrototypeStore = create<PrototypeStore>()(
  persist(
    (set) => ({
      ...initialData,
      resetDemoData: () => set(createCanonicalDemoData()),
      snoozeNextAction: (orderIds, actionKind, until) =>
        set((state) => ({
          orders: updateOrders(state.orders, orderIds, (order) =>
            snoozeOrderAction(order, actionKind, until),
          ),
        })),
      saveNextActionOverride: (orderId, override) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            setNextActionOverride(order, override),
          ),
        })),
      addNote: (orderId, note) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) => addTimelineNote(order, note)),
        })),
    }),
    {
      name: 'jpa-operations-prototype',
      version: DEMO_STATE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        version: state.version,
        orders: state.orders,
        vendorBatches: state.vendorBatches,
      }),
      migrate: migratePrototypeState,
    },
  ),
)
