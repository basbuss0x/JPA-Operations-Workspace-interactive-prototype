import type { Order } from './types'

const unresolvedHetStatuses = new Set(['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'])

export function getHetExceptionCount(order: Order): number {
  return order.items.filter((item) => unresolvedHetStatuses.has(item.matchStatus)).length
}

function isDocumentComplete(document: Order['siplah']['documents'][number]): boolean {
  return (
    document.available &&
    Boolean(document.fileName) &&
    document.verified &&
    (!document.sendToSchoolRequired || document.sentToSchool)
  )
}

export function isSiplahReadyForVendor(order: Order): boolean {
  const process = order.siplah
  const vendorDocumentsComplete = process.documents
    .filter((document) => document.requiredForVendorReady)
    .every(isDocumentComplete)

  return (
    process.accessAvailable &&
    process.orderPlaced &&
    Boolean(process.orderNumber) &&
    order.finalInvoiceAmount !== null &&
    vendorDocumentsComplete
  )
}

export function isSiplahAdminComplete(order: Order): boolean {
  const process = order.siplah
  const adminDocumentsComplete = process.documents
    .filter((document) => document.requiredForAdminCompletion)
    .every(isDocumentComplete)
  return (
    process.orderPlaced &&
    Boolean(process.orderNumber) &&
    order.finalInvoiceAmount !== null &&
    adminDocumentsComplete
  )
}

export function isReadyToDeliver(order: Order): boolean {
  return (
    order.goods.arrivedAt !== null &&
    order.goods.arrivalType !== 'NONE' &&
    order.goods.preDeliveryCheckCompleted
  )
}

export function isCompletionReady(order: Order): boolean {
  return (
    order.fulfillment.progressPercent === 100 &&
    order.fulfillment.deliveredQty === order.fulfillment.orderedQty &&
    order.fulfillment.remainingQty === 0 &&
    order.goods.acceptedBySchoolAt !== null &&
    isSiplahAdminComplete(order) &&
    order.schoolPayment.status === 'LUNAS' &&
    order.benefit.status === 'PAID'
  )
}
