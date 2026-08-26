import { useState, type FormEvent } from 'react'
import type { Order } from '../../domain/types'
import { usePrototypeStore } from '../../store/use-prototype-store'
import { formatDateTime } from '../../utils/format'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { StatusChip } from '../../components/ui/status-chip'

export function OrderTimeline({ order }: { order: Order }) {
  const addNote = usePrototypeStore((state) => state.addNote)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const events = [...order.timeline].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      addNote(order.id, note)
      setNote('')
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Catatan gagal disimpan.')
    }
  }

  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div><h2>Timeline order</h2><p>Riwayat otomatis dan catatan operator untuk memulihkan konteks.</p></div>
        <StatusChip>{events.length} event</StatusChip>
      </div>
      {order.stage !== 'CLOSED' ? (
        <form className="timeline-note-form" onSubmit={submit}>
          <FormField label="Add Note" htmlFor={`timeline-note-${order.id}`} hint="Catatan manual ditandai berbeda dari event SYSTEM.">
            <textarea id={`timeline-note-${order.id}`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Tambahkan konteks operasional…" required />
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
              <div><strong>{event.title}</strong><StatusChip tone={event.type === 'NOTE' ? 'info' : 'neutral'}>{event.type === 'NOTE' ? 'NOTE' : 'SYSTEM'}</StatusChip></div>
              <p>{event.detail}</p>
              <time>{formatDateTime(event.occurredAt)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
