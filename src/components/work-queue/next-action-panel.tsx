import { Link } from 'react-router-dom'
import type { NextAction } from '../../domain/types'
import { actionSourceLabels } from '../../domain/presentation'
import { formatDate } from '../../utils/format'
import { Button } from '../ui/button'
import { StatusChip } from '../ui/status-chip'

interface NextActionPanelProps {
  action: NextAction | null
  schoolName?: string
  compact?: boolean
  emptyState?: { title: string; description: string } | undefined
  onSnooze?: (() => void) | undefined
  onCustomize?: (() => void) | undefined
}

export function NextActionPanel({
  action,
  schoolName,
  compact = false,
  emptyState,
  onSnooze,
  onCustomize,
}: NextActionPanelProps) {
  if (!action) {
    return (
      <section className={`next-action next-action--clear ${compact ? 'next-action--compact' : ''}`}>
        <div className="next-action__icon" aria-hidden="true">✓</div>
        <div className="next-action__main">
          <p className="eyebrow">Next Action utama</p>
          <h2>{emptyState?.title ?? 'Tidak ada tindakan aktif'}</h2>
          <p>{emptyState?.description ?? 'Periksa aksi yang ditunda atau pasang tindakan manual bila konteks lapangan membutuhkannya.'}</p>
        </div>
        {onCustomize ? (
          <div className="next-action__actions">
            <Button variant="ghost" size="sm" onClick={onCustomize}>Atur manual</Button>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section className={`next-action ${compact ? 'next-action--compact' : ''}`}>
      <div className="next-action__main">
        <div className="next-action__label">
          <span className="next-action__pulse" aria-hidden="true" />
          Next Action
          {action.source === 'MANUAL' ? <StatusChip tone="info">{actionSourceLabels[action.source]}</StatusChip> : null}
        </div>
        <h2>{action.title}</h2>
        {schoolName ? <strong className="next-action__school">{schoolName}</strong> : null}
        <p>{action.reason}</p>
        {action.dueAt ? <span className="next-action__due">Jatuh tempo {formatDate(action.dueAt)}</span> : null}
      </div>
      <div className="next-action__actions">
        <Link className="button button--primary button--md" to={action.href}>{action.ctaLabel}</Link>
        {onSnooze && action.snoozable ? (
          <Button variant="ghost" size="sm" onClick={onSnooze}>Tunda 3 hari</Button>
        ) : null}
        {onCustomize ? (
          <Button variant="ghost" size="sm" onClick={onCustomize}>Atur manual</Button>
        ) : null}
      </div>
    </section>
  )
}
