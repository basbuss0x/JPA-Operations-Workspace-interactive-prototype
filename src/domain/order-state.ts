import type { Order } from './types'

const unresolvedHetStatuses = new Set(['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'])

export function getHetExceptionCount(order: Order): number {
  return order.items.filter((item) => unresolvedHetStatuses.has(item.matchStatus)).length
}

export function isSiplahAdminComplete(order: Order): boolean {
  const process = order.siplah
  const requiredDocumentsComplete = process.documents
    .filter((document) => document.required)
    .every(
      (document) =>
        document.available &&
        Boolean(document.fileName) &&
        document.verified &&
        (!document.sendToSchoolRequired || document.sentToSchool),
    )
  return process.orderPlaced && Boolean(process.orderNumber) && requiredDocumentsComplete
}

export function isSiplahComplete(order: Order): boolean {
  return order.siplah.accessAvailable && isSiplahAdminComplete(order)
}

export function isCompletionReady(order: Order): boolean {
  return (
    order.fulfillment.progressPercent === 100 &&
    order.fulfillment.remainingQty === 0 &&
    order.goods.acceptedBySchoolAt !== null &&
    isSiplahComplete(order) &&
    order.schoolPayment.status === 'LUNAS' &&
    order.benefit.status === 'PAID'
  )
}
