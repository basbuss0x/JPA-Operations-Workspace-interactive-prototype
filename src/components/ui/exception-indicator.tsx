interface ExceptionIndicatorProps {
  label: string
  level?: 'warning' | 'danger'
}

export function ExceptionIndicator({ label, level = 'warning' }: ExceptionIndicatorProps) {
  return (
    <span className={`exception-indicator exception-indicator--${level}`}>
      <span aria-hidden="true">!</span>
      {label}
    </span>
  )
}
