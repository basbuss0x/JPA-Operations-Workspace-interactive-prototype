import type { PropsWithChildren } from 'react'

interface FormFieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string | undefined
  errorId?: string | undefined
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  errorId = `${htmlFor}-error`,
  children,
}: PropsWithChildren<FormFieldProps>) {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span id={errorId} className="form-error" role="alert">{error}</span> : null}
      {hint ? <span className="form-field__hint">{hint}</span> : null}
    </div>
  )
}
