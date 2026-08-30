import { useState, type FormEvent } from 'react'
import type { Order } from '../../domain/types'
import { timelineEventTypeLabels } from '../../domain/presentation'
import { usePrototypeStore } from '../../store/use-prototype-store'
import { formatDateTime } from '../../utils/format'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { StatusChip } from '../../components/ui/status-chip'

export function OrderTimeline({ order }: { order: Order }) {
  const addNote = usePrototypeStore((state) => state.addNote)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const events = [...order.timeline].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNoteError(null)
    setError(null)
    const trimmedNote = note.trim()
    if (!trimmedNote) {
      const message = 'Catatan wajib diisi.'
      setNoteError(message)
      document.getElementById(`timeline-note-${order.id}`)?.focus()
      return
    }
    try {
      addNote(order.id, trimmedNote)
      setNote('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Catatan gagal disimpan.')
    }
  }

  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div><h2>Timeline order</h2><p>Riwayat otomatis dan catatan operator untuk memulihkan konteks.</p></div>
        <StatusChip>{events.length} kejadian</StatusChip>
      </div>
      {order.stage !== 'CLOSED' ? (
        <form className="timeline-note-form" onSubmit={submit} noValidate>
          <FormField label="Tambah catatan" htmlFor={`timeline-note-${order.id}`} hint="Catatan manual ditandai berbeda dari kejadian otomatis." error={noteError ?? undefined}>
            <textarea
              id={`timeline-note-${order.id}`}
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                setNoteError(null)
                setError(null)
              }}
              aria-invalid={Boolean(noteError)}
              aria-describedby={noteError ? `timeline-note-${order.id}-error` : undefined}
              rows={2}
              placeholder="Tambahkan konteks operasional…"
              required
            />
          </FormField>
          <Button type="submit" variant="secondary">Simpan catatan</Button>
        </form>
      ) : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <ol className="timeline-list">
        {events.map((event) => (
          <li key={event.id}>
            <div className={event.type === 'NOTE' ? 'timeline-list__marker is-note' : 'timeline-list__marker'} />
            <div className="timeline-list__content">
              <div><strong>{event.title}</strong><StatusChip tone={event.type === 'NOTE' ? 'info' : 'neutral'}>{timelineEventTypeLabels[event.type]}</StatusChip></div>
              <p>{event.detail}</p>
              <time>{formatDateTime(event.occurredAt)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
