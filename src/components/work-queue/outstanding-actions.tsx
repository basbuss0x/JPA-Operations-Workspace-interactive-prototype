import { Link } from 'react-router-dom'
import type { NextAction, NextActionKind } from '../../domain/types'
import { actionSourceLabels } from '../../domain/presentation'
import { formatDate } from '../../utils/format'
import { Button } from '../ui/button'
import { StatusChip } from '../ui/status-chip'

interface OutstandingActionsProps {
  actions: NextAction[]
  onSnooze: (kind: NextActionKind) => void
  onUnsnooze: (kind: NextActionKind) => void
}

export function OutstandingActions({
  actions,
  onSnooze,
  onUnsnooze,
}: OutstandingActionsProps) {
  if (actions.length === 0) return null

  return (
    <section className="outstanding-actions" aria-labelledby="outstanding-actions-title">
      <div className="section-heading">
        <div>
          <h2 id="outstanding-actions-title">Tindakan lain & yang ditunda</h2>
          <p>Kewajiban paralel tetap terlihat meskipun bukan Next Action utama.</p>
        </div>
        <StatusChip tone="info">{actions.length} aksi</StatusChip>
      </div>
      <div className="outstanding-actions__list">
        {actions.map((action) => (
          <article className="outstanding-action-row" key={action.id}>
            <div className="outstanding-action-row__main">
              <div>
                <StatusChip tone={action.source === 'MANUAL' ? 'info' : 'neutral'}>
                  {actionSourceLabels[action.source]}
                </StatusChip>
                {action.availability === 'SNOOZED' ? (
                  <StatusChip tone="warning">
                    Ditunda sampai {formatDate(action.snoozedUntil)}
                  </StatusChip>
                ) : null}
              </div>
              <strong>{action.title}</strong>
              <p>{action.reason}</p>
            </div>
            <div className="outstanding-action-row__actions">
              <Link className="button button--secondary button--sm" to={action.href}>Buka</Link>
              {action.snoozable ? action.availability === 'SNOOZED' ? (
                <Button variant="ghost" size="sm" onClick={() => onUnsnooze(action.kind)}>
                  Aktifkan lagi
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => onSnooze(action.kind)}>
                  Tunda 3 hari
                </Button>
              ) : <span className="action-required-label">Wajib diatur</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
