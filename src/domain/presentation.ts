import { getHetExceptionCount, isSiplahAdminComplete, isSiplahReadyForVendor, isVendorBatchEligible } from './selectors'
import type { Order, VendorBatch } from './types'

export {
  actionSourceLabels,
  arkasSourceTypeLabels,
  arrivalTypeLabels,
  benefitPaymentMethodLabels,
  benefitRecipientTypeLabels,
  benefitStatusLabels,
  hetItemStatusLabels,
  hetResolutionTypeLabels,
  hetReviewStatusLabels,
  lifecycleLabels,
  schoolPaymentMethodLabels,
  schoolPaymentStatusLabels,
  siplahDocumentKindLabels,
  siplahDocumentStatusLabels,
  supplierPaymentStatusLabels,
  syncStatusLabels,
  timelineEventTypeLabels,
  trackerRefreshOutcomeLabels,
  vendorBatchStatusLabels,
} from './presentation-labels'
import {
  arrivalTypeLabels,
  benefitStatusLabels,
  hetReviewStatusLabels,
  schoolPaymentStatusLabels,
  vendorBatchStatusLabels,
} from './presentation-labels'

export interface OrderStateItem {
  label: string
  value: string
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}

export function getOrderStateItems(
  order: Order,
  batch: VendorBatch | null,
): [OrderStateItem, OrderStateItem, OrderStateItem, OrderStateItem, OrderStateItem, OrderStateItem] {
  const exceptions = getHetExceptionCount(order)
  const fulfillmentText = order.goods.arrivedAt
    ? `${order.fulfillment.progressPercent}% · sisa ${order.fulfillment.remainingQty}`
    : arrivalTypeLabels[order.goods.arrivalType]

  return [
    {
      label: 'HET',
      value: exceptions > 0 ? `${exceptions} selisih` : hetReviewStatusLabels[order.het.status],
      tone: exceptions > 0 ? 'danger' : order.het.status === 'APPROVED' ? 'success' : 'neutral',
    },
    {
      label: 'SIPLah',
      value: isSiplahAdminComplete(order)
        ? 'Administrasi lengkap'
        : isSiplahReadyForVendor(order)
          ? 'Siap masuk Vendor Batch'
          : order.siplah.accessAvailable ? 'Dalam proses' : 'Belum mulai',
      tone: isSiplahAdminComplete(order) || isSiplahReadyForVendor(order)
        ? 'success'
        : order.siplah.accessAvailable ? 'warning' : 'neutral',
    },
    {
      label: 'Vendor',
      value: batch ? vendorBatchStatusLabels[batch.status] : isVendorBatchEligible(order) ? 'Siap masuk batch' : 'Belum ada',
      tone: batch?.status === 'ARRIVED' ? 'success' : batch ? 'info' : isVendorBatchEligible(order) ? 'warning' : 'neutral',
    },
    {
      label: 'Barang',
      value: fulfillmentText,
      tone: order.fulfillment.progressPercent === 100 ? 'success' : order.goods.arrivedAt ? 'warning' : 'neutral',
    },
    {
      label: 'Bayar',
      value: schoolPaymentStatusLabels[order.schoolPayment.status],
      tone: order.schoolPayment.status === 'LUNAS' ? 'success' : 'neutral',
    },
    {
      label: 'Benefit',
      value: benefitStatusLabels[order.benefit.status],
      tone: order.benefit.status === 'PAID' ? 'success' : order.benefit.status === 'ELIGIBLE' ? 'warning' : 'neutral',
    },
  ]
}
