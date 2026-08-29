import { getOrderStateItems } from '../../domain/presentation'
import type { Order, VendorBatch } from '../../domain/types'
import { StatusChip } from '../ui/status-chip'

export function OrderStateSummary({
  order,
  batch,
  compact = false,
}: {
  order: Order
  batch: VendorBatch | null
  compact?: boolean
}) {
  return (
    <div className={compact ? 'order-state-summary order-state-summary--compact' : 'order-state-summary'}>
      {getOrderStateItems(order, batch).map((item) => (
        <div className="order-state-summary__item" key={item.label}>
          <span>{item.label}</span>
          <StatusChip tone={item.tone}>{item.value}</StatusChip>
        </div>
      ))}
    </div>
  )
}
