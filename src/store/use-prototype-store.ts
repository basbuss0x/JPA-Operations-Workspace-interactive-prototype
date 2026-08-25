import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createCanonicalDemoData, DEMO_STATE_VERSION } from '../data/demo-data'
import {
  acceptSuggestedHetMatch,
  addTimelineNote,
  attachSiplahDocument,
  chooseHetProduct,
  confirmHetReview,
  createOrderFromExtraction,
  manualOverrideHetItem,
  markSiplahDocumentAvailable,
  recordSiplahOrder,
  reopenHetReview,
  sendSiplahDocumentToSchool,
  setNextActionOverride,
  setSiplahAccessAvailable,
  setSiplahOrderPlaced,
  snoozeOrderAction,
  verifySiplahDocument,
  type CreateOrderFromExtractionInput,
} from '../domain/transitions'
import type {
  NextActionKind,
  NextActionOverride,
  Order,
  ProductMasterItem,
  PrototypeData,
  SiplahDocumentKind,
} from '../domain/types'
import { migratePrototypeState } from './migrate-prototype-state'

interface PrototypeStore extends PrototypeData {
  resetDemoData: () => void
  createExtractedOrder: (
    input: Omit<CreateOrderFromExtractionInput, 'id' | 'schoolId'>,
  ) => string
  acceptHetSuggestion: (orderId: string, itemId: string) => void
  chooseHetProduct: (orderId: string, itemId: string, product: ProductMasterItem) => void
  manualOverrideHet: (
    orderId: string,
    itemId: string,
    input: { reviewedUnitPrice: number; reason: string },
  ) => void
  confirmHet: (orderId: string) => void
  reopenHet: (orderId: string, reason: string) => void
  setSiplahAccess: (orderId: string, available: boolean) => void
  markSiplahOrderPlaced: (orderId: string) => void
  recordSiplahOrder: (
    orderId: string,
    input: { orderNumber: string; finalInvoiceAmount: number },
  ) => void
  markSiplahDocumentAvailable: (orderId: string, kind: SiplahDocumentKind) => void
  attachSiplahDocument: (orderId: string, kind: SiplahDocumentKind, fileName: string) => void
  verifySiplahDocument: (orderId: string, kind: SiplahDocumentKind) => void
  sendSiplahDocument: (orderId: string, kind: SiplahDocumentKind) => void
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

function nextDemoOrderId(orders: Record<string, Order>): string {
  const sequence = Object.keys(orders).reduce((highest, orderId) => {
    const match = /^ORD-2026-(\d+)$/.exec(orderId)
    return match?.[1] ? Math.max(highest, Number(match[1])) : highest
  }, 239)
  return `ORD-2026-${String(sequence + 1).padStart(3, '0')}`
}

function schoolIdFromName(schoolName: string): string {
  return `SCH-${schoolName.toLocaleUpperCase('id').replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
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
      createExtractedOrder: (input) => {
        let createdOrderId = ''
        set((state) => {
          createdOrderId = nextDemoOrderId(state.orders)
          const order = createOrderFromExtraction({
            ...input,
            id: createdOrderId,
            schoolId: schoolIdFromName(input.schoolName),
          })
          return { orders: { ...state.orders, [createdOrderId]: order } }
        })
        return createdOrderId
      },
      acceptHetSuggestion: (orderId, itemId) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            acceptSuggestedHetMatch(order, itemId),
          ),
        })),
      chooseHetProduct: (orderId, itemId, product) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            chooseHetProduct(order, itemId, product),
          ),
        })),
      manualOverrideHet: (orderId, itemId, input) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            manualOverrideHetItem(order, itemId, input),
          ),
        })),
      confirmHet: (orderId) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) => confirmHetReview(order)),
        })),
      reopenHet: (orderId, reason) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) => reopenHetReview(order, reason)),
        })),
      setSiplahAccess: (orderId, available) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            setSiplahAccessAvailable(order, available),
          ),
        })),
      markSiplahOrderPlaced: (orderId) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            setSiplahOrderPlaced(order),
          ),
        })),
      recordSiplahOrder: (orderId, input) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            recordSiplahOrder(order, input),
          ),
        })),
      markSiplahDocumentAvailable: (orderId, kind) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            markSiplahDocumentAvailable(order, kind),
          ),
        })),
      attachSiplahDocument: (orderId, kind, fileName) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            attachSiplahDocument(order, kind, fileName),
          ),
        })),
      verifySiplahDocument: (orderId, kind) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            verifySiplahDocument(order, kind),
          ),
        })),
      sendSiplahDocument: (orderId, kind) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            sendSiplahDocumentToSchool(order, kind),
          ),
        })),
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
