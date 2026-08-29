import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createCanonicalDemoData, DEMO_STATE_VERSION } from '../data/demo-data'
import { findDuplicateSchool, isSchoolEligible, normalizeSchoolName } from '../domain/school'
import {
  acceptSuggestedHetMatch,
  addTimelineNote,
  attachSiplahDocument,
  chooseHetProduct,
  closeOrder,
  completePreDeliveryCheck,
  confirmHetReview,
  createOrderFromExtraction,
  createVendorBatch as createVendorBatchTransition,
  generateVendorRecap as generateVendorRecapTransition,
  manualOverrideHetItem,
  markSiplahDocumentAvailable,
  recordBenefitPayment,
  recordBenefitSchoolConfirmation,
  recordGoodsArrival,
  recordSchoolAcceptance,
  recordSchoolPayment,
  recordSiplahOrder,
  refreshFulfillmentSummary,
  reopenHetReview,
  reopenOrder,
  sendSiplahDocumentToSchool,
  setNextActionOverride,
  setPaymentFollowUpReminder,
  setSiplahAccessAvailable,
  setVendorFollowUpReminder,
  setSiplahOrderPlaced,
  snoozeOrderAction,
  transitionVendorBatch,
  verifySiplahDocument,
  type CreateOrderFromExtractionInput,
} from '../domain/transitions'
import type {
  BenefitPaymentInput,
  FulfillmentRefreshResult,
  GoodsArrivalAllocation,
  NextActionKind,
  NextActionOverride,
  Order,
  ProductMasterItem,
  PrototypeData,
  School,
  SchoolPaymentInput,
  SiplahDocumentKind,
} from '../domain/types'
import { migratePrototypeState } from './migrate-prototype-state'

type CreateExtractedOrderInput = Omit<
  CreateOrderFromExtractionInput,
  'id' | 'schoolId' | 'schoolName'
> & {
  school: School
}

interface PrototypeStore extends PrototypeData {
  resetDemoData: () => void
  createExtractedOrder: (input: CreateExtractedOrderInput) => string
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
  createVendorBatch: (orderIds: string[], batchId: string) => void
  generateVendorRecap: (batchId: string) => void
  markVendorBatchSent: (batchId: string) => void
  markVendorConfirmed: (batchId: string) => void
  startVendorProcessing: (batchId: string) => void
  setVendorFollowUp: (batchId: string, dueAt: string | null) => void
  recordVendorGoodsArrival: (batchId: string, allocations: GoodsArrivalAllocation[]) => void
  completeGoodsCheck: (orderId: string, note: string) => void
  refreshTrackerSummary: (orderId: string, result: FulfillmentRefreshResult) => void
  recordSchoolAcceptance: (orderId: string) => void
  confirmSchoolPayment: (orderId: string, input: SchoolPaymentInput) => void
  setPaymentFollowUp: (orderId: string, dueAt: string | null) => void
  paySchoolBenefit: (orderId: string, input: BenefitPaymentInput) => void
  confirmBenefitReceipt: (orderId: string) => void
  closeSchoolOrder: (orderId: string) => void
  reopenSchoolOrder: (orderId: string, reason: string) => void
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

function resolveSchoolContext(
  schools: Record<string, School>,
  candidate: School,
): School {
  if (!isSchoolEligible(candidate)) {
    throw new Error('Sekolah tidak aktif dan tidak dapat menjadi target order baru.')
  }
  const registered = schools[candidate.id]
  if (registered) {
    if (!isSchoolEligible(registered)) {
      throw new Error('Sekolah tidak aktif dan tidak dapat menjadi target order baru.')
    }
    if (normalizeSchoolName(registered.name) !== normalizeSchoolName(candidate.name)) {
      throw new Error('Identitas sekolah tidak cocok dengan registry sekolah.')
    }
    return registered
  }
  const duplicate = findDuplicateSchool(schools, candidate.name)
  if (duplicate) {
    throw new Error(`Sekolah kemungkinan duplikat: ${duplicate.name} (${duplicate.id}).`)
  }
  return candidate
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
          const school = resolveSchoolContext(state.schools, input.school)
          createdOrderId = nextDemoOrderId(state.orders)
          const order = createOrderFromExtraction({
            ...input,
            id: createdOrderId,
            schoolId: school.id,
            schoolName: school.name,
          })
          return {
            schools: state.schools[school.id]
              ? state.schools
              : { ...state.schools, [school.id]: { ...school } },
            orders: { ...state.orders, [createdOrderId]: order },
          }
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
      createVendorBatch: (orderIds, batchId) =>
        set((state) => createVendorBatchTransition(state, orderIds, batchId)),
      generateVendorRecap: (batchId) =>
        set((state) => generateVendorRecapTransition(state, batchId)),
      markVendorBatchSent: (batchId) =>
        set((state) => transitionVendorBatch(state, batchId, 'SENT_TO_VENDOR')),
      markVendorConfirmed: (batchId) =>
        set((state) => transitionVendorBatch(state, batchId, 'VENDOR_CONFIRMED')),
      startVendorProcessing: (batchId) =>
        set((state) => transitionVendorBatch(state, batchId, 'PROCESSING')),
      setVendorFollowUp: (batchId, dueAt) =>
        set((state) => setVendorFollowUpReminder(state, batchId, dueAt)),
      recordVendorGoodsArrival: (batchId, allocations) =>
        set((state) => recordGoodsArrival(state, batchId, allocations)),
      completeGoodsCheck: (orderId, note) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            completePreDeliveryCheck(order, note),
          ),
        })),
      refreshTrackerSummary: (orderId, result) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            refreshFulfillmentSummary(order, result),
          ),
        })),
      recordSchoolAcceptance: (orderId) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            recordSchoolAcceptance(order),
          ),
        })),
      confirmSchoolPayment: (orderId, input) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            recordSchoolPayment(order, input),
          ),
        })),
      setPaymentFollowUp: (orderId, dueAt) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            setPaymentFollowUpReminder(order, dueAt),
          ),
        })),
      paySchoolBenefit: (orderId, input) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            recordBenefitPayment(order, input),
          ),
        })),
      confirmBenefitReceipt: (orderId) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) =>
            recordBenefitSchoolConfirmation(order),
          ),
        })),
      closeSchoolOrder: (orderId) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) => closeOrder(order)),
        })),
      reopenSchoolOrder: (orderId, reason) =>
        set((state) => ({
          orders: updateOrders(state.orders, [orderId], (order) => reopenOrder(order, reason)),
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
        schools: state.schools,
        orders: state.orders,
        vendorBatches: state.vendorBatches,
      }),
      migrate: migratePrototypeState,
    },
  ),
)
