import { getOrderStateItems } from '../../domain/presentation'
import type { Order, VendorBatch } from '../../domain/types'
import { StatusChip } from '../ui/status-chip'

export function OrderStateSummary({ order, batch }: { order: Order; batch: VendorBatch | null }) {
  return (
    <div className="order-state-summary">
      {getOrderStateItems(order, batch).map((item) => (
        <div className="order-state-summary__item" key={item.label}>
          <span>{item.label}</span>
          <StatusChip tone={item.tone}>{item.value}</StatusChip>
        </div>
      ))}
    </div>
  )
}
