import { getHetExceptionCount, isSiplahAdminComplete, isSiplahReadyForVendor, isVendorBatchEligible } from './selectors'
import type { Order, VendorBatch } from './types'

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
    : 'Belum tiba'

  return [
    {
      label: 'HET',
      value: exceptions > 0 ? `${exceptions} selisih` : order.het.status === 'APPROVED' ? 'Disetujui' : 'Belum direview',
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
      value: batch?.status.replaceAll('_', ' ') ?? (isVendorBatchEligible(order) ? 'Siap batch' : 'Belum ada'),
      tone: batch?.status === 'ARRIVED' ? 'success' : batch ? 'info' : isVendorBatchEligible(order) ? 'warning' : 'neutral',
    },
    {
      label: 'Barang',
      value: fulfillmentText,
      tone: order.fulfillment.progressPercent === 100 ? 'success' : order.goods.arrivedAt ? 'warning' : 'neutral',
    },
    {
      label: 'Bayar',
      value: order.schoolPayment.status,
      tone: order.schoolPayment.status === 'LUNAS' ? 'success' : 'neutral',
    },
    {
      label: 'Benefit',
      value: order.benefit.status.replaceAll('_', ' '),
      tone: order.benefit.status === 'PAID' ? 'success' : order.benefit.status === 'ELIGIBLE' ? 'warning' : 'neutral',
    },
  ]
}
