import { Link } from 'react-router-dom'
import { deriveNextAction } from '../../domain/next-action'
import { getHetExceptionCount } from '../../domain/selectors'
import type { Order, VendorBatch } from '../../domain/types'
import { lifecycleLabels } from '../../domain/types'
import { ExceptionIndicator } from '../ui/exception-indicator'
import { StatusChip } from '../ui/status-chip'

interface OrderSummaryRowProps {
  order: Order
  batch: VendorBatch | null
}

export function OrderSummaryRow({ order, batch }: OrderSummaryRowProps) {
  const action = deriveNextAction(order, batch)
  const exceptions = getHetExceptionCount(order)
  return (
    <Link className="order-summary-row" to={`/orders/${order.id}`}>
      <div className="order-summary-row__identity">
        <strong>{order.schoolName}</strong>
        <span>{order.id}</span>
      </div>
      <StatusChip tone={order.stage === 'CLOSED' ? 'success' : 'neutral'}>
        {lifecycleLabels[order.stage]}
      </StatusChip>
      <div className="order-summary-row__signal">
        {exceptions > 0 ? <ExceptionIndicator label={`${exceptions} selisih HET`} level="danger" /> : null}
        {exceptions === 0 && action ? <span>{action.title}</span> : null}
        {!action ? <span className="muted">Tidak ada tindakan aktif</span> : null}
      </div>
      <span className="order-summary-row__arrow" aria-hidden="true">→</span>
    </Link>
  )
}
