import type { PropsWithChildren } from 'react'

interface FormFieldProps {
  label: string
  htmlFor: string
  hint?: string
}

export function FormField({ label, htmlFor, hint, children }: PropsWithChildren<FormFieldProps>) {
  return (
    <label className="form-field" htmlFor={htmlFor}>
      <span className="form-field__label">{label}</span>
      {children}
      {hint ? <span className="form-field__hint">{hint}</span> : null}
    </label>
  )
}
