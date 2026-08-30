import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buildVendorRecap, getVendorBatchOrders } from '../domain/selectors'
import { arrivalTypeLabels, vendorBatchStatusLabels } from '../domain/presentation'
import type { GoodsArrivalAllocation } from '../domain/types'
import { usePrototypeStore } from '../store/use-prototype-store'
import { formatDate, formatDateTime } from '../utils/format'
import { ReminderForm } from '../components/work-queue/reminder-form'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { Modal } from '../components/ui/modal'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'
import { VendorRecapView } from '../features/vendor/vendor-recap-view'

const arrivalOptions = [
  { value: 'NONE', label: arrivalTypeLabels.NONE },
  { value: 'PARTIAL', label: 'Tiba sebagian' },
  { value: 'FULL', label: 'Tiba penuh' },
] as const

type ArrivalChoice = typeof arrivalOptions[number]['value']

export function VendorBatchDetailPage() {
  const { batchId } = useParams()
  const batch = usePrototypeStore((state) => batchId ? state.vendorBatches[batchId] : undefined)
  const orders = usePrototypeStore((state) => state.orders)
  const generateVendorRecap = usePrototypeStore((state) => state.generateVendorRecap)
  const markVendorBatchSent = usePrototypeStore((state) => state.markVendorBatchSent)
  const markVendorConfirmed = usePrototypeStore((state) => state.markVendorConfirmed)
  const startVendorProcessing = usePrototypeStore((state) => state.startVendorProcessing)
  const setVendorFollowUp = usePrototypeStore((state) => state.setVendorFollowUp)
  const recordVendorGoodsArrival = usePrototypeStore((state) => state.recordVendorGoodsArrival)
  const [actionError, setActionError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [arrivalOpen, setArrivalOpen] = useState(false)
  const [arrivalChoices, setArrivalChoices] = useState<Record<string, ArrivalChoice>>({})

  const memberOrders = useMemo(
    () => batch ? getVendorBatchOrders(batch, orders) : [],
    [batch, orders],
  )
  const preview = useMemo(() => {
    if (!batch) return { recap: null, error: null }
    try {
      return { recap: buildVendorRecap(memberOrders), error: null }
    } catch (error) {
      return { recap: null, error: error instanceof Error ? error.message : 'Recap tidak valid.' }
    }
  }, [batch, memberOrders])

  if (!batch) {
    return (
      <EmptyState
        title="Vendor Batch tidak ditemukan"
        description="Batch ID tidak ada di demo state atau data lokal sudah direset."
        action={<Link className="button button--secondary button--md" to="/vendor-batches">Kembali ke Vendor Batch</Link>}
      />
    )
  }

  const runAction = (action: () => void, message: string) => {
    setActionError(null)
    setFeedback(null)
    try {
      action()
      setFeedback(message)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Tindakan gagal disimpan.')
    }
  }

  const generateAndDownload = async () => {
    if (!preview.recap) {
      setActionError(preview.error ?? 'Recap tidak dapat dibuat.')
      return
    }
    setActionError(null)
    setFeedback(null)
    setExporting(true)
    try {
      const { downloadVendorWorkbook } = await import('../features/vendor/vendor-workbook')
      downloadVendorWorkbook(batch, preview.recap)
      generateVendorRecap(batch.id)
      setFeedback('Rekap berhasil dibuat. Batch belum dikirim ke vendor.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Rekap gagal dibuat.')
    } finally {
      setExporting(false)
    }
  }

  const openArrival = () => {
    setActionError(null)
    setArrivalChoices(Object.fromEntries(memberOrders.map((order) => [order.id, 'NONE'])))
    setArrivalOpen(true)
  }

  const saveArrival = () => {
    const allocations: GoodsArrivalAllocation[] = Object.entries(arrivalChoices).flatMap(
      ([orderId, arrivalType]) => arrivalType === 'NONE' ? [] : [{ orderId, arrivalType }],
    )
    setActionError(null)
    try {
      recordVendorGoodsArrival(batch.id, allocations)
      setArrivalOpen(false)
      setFeedback('Kedatangan dicatat hanya untuk alokasi order yang dipilih.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Kedatangan gagal dicatat.')
    }
  }

  const timeline = [...batch.timeline].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const reminderAllowed = ['SENT_TO_VENDOR', 'VENDOR_CONFIRMED', 'PROCESSING', 'PARTIALLY_ARRIVED'].includes(batch.status)

  return (
    <div className="page-stack vendor-batch-detail-page">
      <Link className="back-link" to="/vendor-batches">← Semua Vendor Batch</Link>
      <PageHeader
        eyebrow="Vendor Batch detail"
        title={batch.id}
        description={`${memberOrders.length} order anggota · dibuat ${formatDate(batch.createdAt)}. Quantity recap selalu dihitung otomatis dari OrderItem.`}
        actions={<StatusChip tone={batch.status === 'ARRIVED' ? 'success' : batch.status === 'DRAFT' ? 'warning' : 'info'} dot>{vendorBatchStatusLabels[batch.status]}</StatusChip>}
      />

      {batch.status === 'RECAP_GENERATED' ? (
        <div className="callout callout--info recap-not-sent" role="status">
          <strong>Rekap sudah dibuat, belum dikirim ke vendor.</strong> Download tidak pernah dianggap sebagai pengiriman. Gunakan tindakan “Mark sent to vendor” setelah benar-benar dikirim.
        </div>
      ) : null}
      {feedback ? <div className="callout callout--success" role="status">{feedback}</div> : null}
      {actionError && !arrivalOpen ? <div className="callout callout--danger" role="alert"><strong>Tindakan gagal.</strong> {actionError}</div> : null}

      <section className="workspace-panel batch-actions-panel" aria-labelledby="batch-actions-title">
        <div className="panel-heading">
          <div><h2 id="batch-actions-title">Tindakan tahap proses</h2><p>Setiap tombol mencatat satu kejadian bisnis; tidak ada tombol “lanjutkan status” generik.</p></div>
        </div>
        <div className="batch-lifecycle-actions">
          {batch.status === 'DRAFT' ? <Button onClick={generateAndDownload} disabled={exporting}>{exporting ? 'Generating recap…' : 'Generate recap .xlsx'}</Button> : null}
          {batch.status === 'RECAP_GENERATED' ? (
            <>
              <Button variant="secondary" onClick={generateAndDownload} disabled={exporting}>{exporting ? 'Regenerating recap…' : 'Regenerate recap .xlsx'}</Button>
              <Button onClick={() => runAction(() => markVendorBatchSent(batch.id), 'Batch ditandai sudah dikirim ke vendor.')}>Mark sent to vendor</Button>
            </>
          ) : null}
          {batch.status === 'SENT_TO_VENDOR' ? <Button onClick={() => runAction(() => markVendorConfirmed(batch.id), 'Konfirmasi vendor dicatat.')}>Mark vendor confirmed</Button> : null}
          {batch.status === 'VENDOR_CONFIRMED' ? <Button onClick={() => runAction(() => startVendorProcessing(batch.id), 'Vendor mulai processing.')}>Start processing</Button> : null}
          {batch.status === 'PROCESSING' || batch.status === 'PARTIALLY_ARRIVED' ? (
            <Button onClick={openArrival}>{batch.status === 'PROCESSING' ? 'Record partial/full arrival' : 'Record additional/full arrival'}</Button>
          ) : null}
          {batch.status === 'ARRIVED' ? <span className="inline-clear-state">✓ Semua order anggota tercatat tiba penuh. Goods handling berikutnya tetap di TASK 11.</span> : null}
        </div>
      </section>

      {reminderAllowed ? (
        <section className="workspace-panel vendor-reminder-panel" aria-labelledby="vendor-reminder-title">
          <div>
            <h2 id="vendor-reminder-title">Vendor follow-up reminder</h2>
            <p>{vendorBatchStatusLabels.PROCESSING} tetap pasif sampai tanggal eksplisit ini tercapai. Tidak ada ambang otomatis.</p>
          </div>
          <ReminderForm
            inputId="vendor-follow-up-date"
            currentDueAt={batch.followUpDueAt}
            setupRequired={batch.status === 'PROCESSING' || batch.status === 'PARTIALLY_ARRIVED'}
            setupTitle="Atur tindak lanjut vendor."
            setupDescription="Jadwal batch belum dikonfirmasi; kolom sudah diisi saran tiga hari dari hari ini. Satu reminder berlaku untuk order anggota yang belum tiba penuh."
            savedTitle="Reminder vendor tersimpan."
            savedDescription={(date) => `Follow-up dijadwalkan pada ${date} untuk order anggota yang belum tiba penuh.`}
            saveSuccessMessage="Reminder follow-up vendor disimpan."
            clearSuccessMessage="Reminder follow-up vendor dihapus."
            onSave={(dueAt) => setVendorFollowUp(batch.id, dueAt)}
            onClear={() => setVendorFollowUp(batch.id, null)}
            onBeforeAction={() => {
              setActionError(null)
              setFeedback(null)
            }}
            onCompleted={setFeedback}
          />
        </section>
      ) : null}

      <section className="workspace-panel batch-members-panel" aria-labelledby="batch-members-title">
        <div className="panel-heading">
          <div><h2 id="batch-members-title">Sekolah & order anggota</h2><p>Kedatangan dicatat per order; perubahan satu sekolah tidak mengubah saudaranya.</p></div>
          <StatusChip>{memberOrders.length} order</StatusChip>
        </div>
        <div className="batch-member-list">
          {memberOrders.map((order) => (
            <article key={order.id} className="batch-member-row">
              <div><Link to={`/orders/${order.id}?tab=vendor`}>{order.schoolName}</Link><span>{order.id} · {order.siplah.orderNumber}</span></div>
              <div><StatusChip tone={order.goods.arrivalType === 'FULL' ? 'success' : order.goods.arrivalType === 'PARTIAL' ? 'warning' : 'neutral'}>Barang · {arrivalTypeLabels[order.goods.arrivalType]}</StatusChip><strong>{order.items.reduce((total, item) => total + item.quantity, 0)} buku</strong></div>
            </article>
          ))}
        </div>
      </section>

      {preview.error ? <div className="callout callout--danger" role="alert"><strong>Recap invalid.</strong> {preview.error}</div> : null}
      {preview.recap ? <VendorRecapView recap={preview.recap} /> : null}

      <section className="workspace-panel batch-timeline-panel" aria-labelledby="batch-timeline-title">
        <div className="panel-heading"><div><h2 id="batch-timeline-title">Timeline batch</h2><p>Timestamps penting untuk membedakan dibuat, direkap, dikirim, dan diproses.</p></div></div>
        <div className="batch-timestamps">
          <span><small>Dibuat</small><strong>{formatDateTime(batch.createdAt)}</strong></span>
          <span><small>Recap terakhir</small><strong>{batch.recapGeneratedAt ? formatDateTime(batch.recapGeneratedAt) : '—'}</strong></span>
          <span><small>Dikirim</small><strong>{batch.sentAt ? formatDateTime(batch.sentAt) : '—'}</strong></span>
          <span><small>Dikonfirmasi</small><strong>{batch.confirmedAt ? formatDateTime(batch.confirmedAt) : '—'}</strong></span>
          <span><small>Processing</small><strong>{batch.processingStartedAt ? formatDateTime(batch.processingStartedAt) : '—'}</strong></span>
        </div>
        {timeline.length > 0 ? (
          <ol className="mini-timeline">
            {timeline.map((event) => <li key={event.id}><span className="mini-timeline__dot" /><div><strong>{event.title}</strong><p>{event.detail}</p><time>{formatDateTime(event.occurredAt)}</time></div></li>)}
          </ol>
        ) : <div className="inline-clear-state inline-clear-state--neutral">Fixture lama belum memiliki event batch terperinci.</div>}
      </section>

      <Modal
        open={arrivalOpen}
        title="Catat kedatangan per sekolah/order"
        description="Pilih hanya alokasi yang benar-benar tiba. Order lain tidak akan dimutasi."
        onClose={() => setArrivalOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setArrivalOpen(false)}>Batal</Button><Button onClick={saveArrival}>Simpan kedatangan</Button></>}
      >
        {actionError ? <div className="callout callout--danger" role="alert"><strong>Kedatangan belum tersimpan.</strong> {actionError}</div> : null}
        <div className="arrival-allocation-list">
          {memberOrders.map((order) => (
            <fieldset key={order.id} disabled={order.goods.arrivalType === 'FULL'}>
              <legend>{order.schoolName}<small>{order.id} · saat ini {arrivalTypeLabels[order.goods.arrivalType]}</small></legend>
              <div>
                {arrivalOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name={`arrival-${order.id}`}
                      value={option.value}
                      checked={(arrivalChoices[order.id] ?? 'NONE') === option.value}
                      onChange={() => setArrivalChoices((current) => ({ ...current, [order.id]: option.value }))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Modal>
    </div>
  )
}
