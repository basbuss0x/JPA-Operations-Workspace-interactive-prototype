import type { PropsWithChildren } from 'react'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

interface StatusChipProps {
  tone?: StatusTone
  dot?: boolean
  className?: string
}

export function StatusChip({
  tone = 'neutral',
  dot = false,
  className = '',
  children,
}: PropsWithChildren<StatusChipProps>) {
  return (
    <span className={`status-chip status-chip--${tone} ${className}`}>
      {dot ? <span className="status-chip__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
