import { Link } from 'react-router-dom'
import { derivePrimaryNextAction, getActiveActionCandidates } from '../../domain/next-action'
import { getOrderActionCandidates } from '../../domain/selectors'
import { getHetExceptionCount } from '../../domain/selectors'
import type { Order, VendorBatch } from '../../domain/types'
import { lifecycleLabels } from '../../domain/presentation'
import { ExceptionIndicator } from '../ui/exception-indicator'
import { StatusChip } from '../ui/status-chip'

interface OrderSummaryRowProps {
  order: Order
  batch: VendorBatch | null
  now: Date
}

export function OrderSummaryRow({ order, batch, now }: OrderSummaryRowProps) {
  const candidates = getActiveActionCandidates(
    getOrderActionCandidates(order, batch ? { [batch.id]: batch } : {}, now),
  )
  const action = derivePrimaryNextAction(candidates)
  const otherActionCount = Math.max(0, candidates.length - (action ? 1 : 0))
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
        {exceptions > 0 && action?.kind !== 'REVIEW_HET' ? (
          <ExceptionIndicator label={`${exceptions} selisih HET`} level="danger" />
        ) : null}
        {action ? <span>{action.title}</span> : <span className="muted">{order.stage === 'CLOSED' ? 'Order selesai' : 'Tidak ada tindakan aktif'}</span>}
        {otherActionCount > 0 ? <span className="other-action-count">+{otherActionCount} aksi lain</span> : null}
      </div>
      <span className="order-summary-row__arrow" aria-hidden="true">→</span>
    </Link>
  )
}
