import { Link } from 'react-router-dom'
import type { NextAction } from '../../domain/types'
import { formatDate } from '../../utils/format'
import { Button } from '../ui/button'
import { StatusChip } from '../ui/status-chip'

interface NextActionPanelProps {
  action: NextAction | null
  schoolName?: string
  snoozedUntil?: string | null
  compact?: boolean
  onSnooze?: (() => void) | undefined
  onUnsnooze?: (() => void) | undefined
  onCustomize?: (() => void) | undefined
}

export function NextActionPanel({
  action,
  schoolName,
  snoozedUntil = null,
  compact = false,
  onSnooze,
  onUnsnooze,
  onCustomize,
}: NextActionPanelProps) {
  if (!action) {
    return (
      <section className={`next-action next-action--clear ${compact ? 'next-action--compact' : ''}`}>
        <div className="next-action__icon" aria-hidden="true">✓</div>
        <div>
          <p className="eyebrow">Next Action</p>
          <h2>Tidak ada tindakan mendesak</h2>
          <p>Order ini tidak memiliki pekerjaan aktif dari state saat ini.</p>
        </div>
      </section>
    )
  }

  return (
    <section className={`next-action ${compact ? 'next-action--compact' : ''}`}>
      <div className="next-action__main">
        <div className="next-action__label">
          <span className="next-action__pulse" aria-hidden="true" />
          Next Action
          {action.source === 'MANUAL' ? <StatusChip tone="info">Override manual</StatusChip> : null}
        </div>
        <h2>{action.title}</h2>
        {schoolName ? <strong className="next-action__school">{schoolName}</strong> : null}
        <p>{action.reason}</p>
        {action.dueAt ? <span className="next-action__due">Jatuh tempo {formatDate(action.dueAt)}</span> : null}
        {snoozedUntil ? (
          <span className="next-action__due">Disnooze sampai {formatDate(snoozedUntil)}</span>
        ) : null}
      </div>
      <div className="next-action__actions">
        <Link className="button button--primary button--md" to={action.href}>{action.ctaLabel}</Link>
        {snoozedUntil && onUnsnooze ? (
          <Button variant="secondary" size="sm" onClick={onUnsnooze}>Aktifkan lagi</Button>
        ) : onSnooze ? (
          <Button variant="ghost" size="sm" onClick={onSnooze}>Snooze 3 hari</Button>
        ) : null}
        {onCustomize ? (
          <Button variant="ghost" size="sm" onClick={onCustomize}>Atur manual</Button>
        ) : null}
      </div>
    </section>
  )
}
