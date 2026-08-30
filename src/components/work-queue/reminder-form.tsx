import { useState, type FormEvent } from 'react'
import { Button } from '../ui/button'
import { FormField } from '../ui/form-field'
import { formatDate } from '../../utils/format'
import {
  calendarDateToReminderTimestamp,
  futureCalendarDate,
  reminderTimestampToCalendarDate,
  validateReminderCalendarDate,
} from '../../utils/reminder-date'

interface ReminderFormProps {
  inputId: string
  currentDueAt: string | null
  setupRequired: boolean
  setupTitle: string
  setupDescription: string
  savedTitle: string
  savedDescription: (calendarDate: string) => string
  hint?: string
  saveSuccessMessage: string
  clearSuccessMessage: string
  onSave: (dueAt: string) => void
  onClear: () => void
  onBeforeAction?: () => void
  onCompleted?: (message: string) => void
}

export function ReminderForm({
  inputId,
  currentDueAt,
  setupRequired,
  setupTitle,
  setupDescription,
  savedTitle,
  savedDescription,
  hint = 'Tanggal hari ini atau sesudahnya; tetap klik Simpan pengingat untuk konfirmasi.',
  saveSuccessMessage,
  clearSuccessMessage,
  onSave,
  onClear,
  onBeforeAction,
  onCompleted,
}: ReminderFormProps) {
  const storedCalendarDate = reminderTimestampToCalendarDate(currentDueAt)
  const [calendarDate, setCalendarDate] = useState(
    storedCalendarDate || futureCalendarDate(3),
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const hasStoredReminder = Boolean(currentDueAt)

  const clearErrors = () => {
    setValidationError(null)
    setActionError(null)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    onBeforeAction?.()
    clearErrors()

    const error = validateReminderCalendarDate(calendarDate)
    if (error) {
      setValidationError(error)
      document.getElementById(inputId)?.focus()
      return
    }

    setSubmitting(true)
    try {
      onSave(calendarDateToReminderTimestamp(calendarDate))
      onCompleted?.(saveSuccessMessage)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Pengingat belum tersimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  const clear = () => {
    if (submitting) return
    onBeforeAction?.()
    clearErrors()
    setSubmitting(true)
    try {
      onClear()
      setCalendarDate('')
      onCompleted?.(clearSuccessMessage)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Pengingat belum tersimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {setupRequired && !storedCalendarDate ? (
        <div className="callout callout--warning reminder-setup-callout">
          <strong>{setupTitle}</strong> {setupDescription}
        </div>
      ) : storedCalendarDate ? (
        <div className="callout callout--success reminder-setup-callout">
          <strong>{savedTitle}</strong> {savedDescription(formatDate(currentDueAt))}
        </div>
      ) : null}
      {actionError ? (
        <div className="callout callout--danger reminder-action-error" role="alert">
          <strong>Pengingat belum tersimpan.</strong> {actionError} Coba lagi tanpa memasukkan ulang tanggal.
        </div>
      ) : null}
      <form className="inline-action-form" onSubmit={submit} noValidate>
        <FormField
          label="Tanggal tindak lanjut"
          htmlFor={inputId}
          hint={hint}
          error={validationError ?? undefined}
        >
          <input
            id={inputId}
            type="date"
            value={calendarDate}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? `${inputId}-error` : undefined}
            onChange={(event) => {
              setCalendarDate(event.target.value)
              clearErrors()
              onBeforeAction?.()
            }}
          />
        </FormField>
        <div className="reminder-form-actions">
          <Button variant="secondary" type="submit" disabled={submitting}>Simpan pengingat</Button>
          {hasStoredReminder ? (
            <Button variant="ghost" type="button" onClick={clear} disabled={submitting}>
              Hapus pengingat
            </Button>
          ) : null}
        </div>
      </form>
    </>
  )
}
