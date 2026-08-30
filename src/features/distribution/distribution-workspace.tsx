import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getMockTrackerRefresh, type MockTrackerOutcome } from '../../data/tracker-fixtures'
import { isReadyToDeliver } from '../../domain/selectors'
import type { Order, VendorBatch } from '../../domain/types'
import { arrivalTypeLabels, vendorBatchStatusLabels } from '../../domain/presentation'
import { usePrototypeStore } from '../../store/use-prototype-store'
import { formatDate, formatDateTime } from '../../utils/format'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { Modal } from '../../components/ui/modal'
import { StatusChip } from '../../components/ui/status-chip'

function StateRow({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string | undefined }) {
  return (
    <div className="detail-row">
      <div><span className="detail-row__label">{label}</span>{detail ? <small>{detail}</small> : null}</div>
      <div className="detail-row__value">{value}</div>
    </div>
  )
}

export function DistributionWorkspace({ order, batch }: { order: Order; batch: VendorBatch | null }) {
  const completeGoodsCheck = usePrototypeStore((state) => state.completeGoodsCheck)
  const refreshTrackerSummary = usePrototypeStore((state) => state.refreshTrackerSummary)
  const recordSchoolAcceptance = usePrototypeStore((state) => state.recordSchoolAcceptance)
  const [checkOpen, setCheckOpen] = useState(false)
  const [checkNote, setCheckNote] = useState('')
  const [refreshOutcome, setRefreshOutcome] = useState<MockTrackerOutcome>('SUCCESS')
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fulfillment = order.fulfillment
  const canAccept =
    order.stage !== 'CLOSED' &&
    fulfillment.progressPercent === 100 &&
    fulfillment.remainingQty === 0 &&
    fulfillment.deliveredQty === fulfillment.orderedQty &&
    order.goods.preDeliveryCheckCompleted &&
    order.goods.arrivalType === 'FULL' &&
    !order.goods.acceptedBySchoolAt

  const run = (action: () => void, message: string) => {
    setError(null)
    setFeedback(null)
    try {
      action()
      setFeedback(message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tindakan distribusi gagal.')
    }
  }

  const submitCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      completeGoodsCheck(order.id, checkNote)
      setCheckOpen(false)
      setFeedback('Pemeriksaan barang selesai. Status pengantaran sekolah tidak berubah.')
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pemeriksaan barang gagal dicatat.')
    }
  }

  const refresh = () => {
    run(
      () => refreshTrackerSummary(order.id, getMockTrackerRefresh(order, refreshOutcome)),
      refreshOutcome === 'SUCCESS'
        ? 'Cache fulfillment diperbarui dari tracker demo.'
        : 'Percobaan refresh dicatat; cache quantity terakhir tetap dipertahankan.',
    )
  }

  return (
    <div className="distribution-workspace">
      {feedback ? <div className="callout callout--success" role="status">{feedback}</div> : null}
      {error ? <div className="callout callout--danger" role="alert"><strong>Tindakan gagal.</strong> {error}</div> : null}

      <section className="workspace-panel distribution-arrival-panel">
        <div className="panel-heading">
          <div><h2>Barang dari Vendor</h2><p>Kedatangan vendor ke JPA tetap dikendalikan oleh alokasi Vendor Batch.</p></div>
          <StatusChip tone={order.goods.arrivalType === 'FULL' ? 'success' : order.goods.arrivalType === 'PARTIAL' ? 'warning' : 'neutral'}>
            {arrivalTypeLabels[order.goods.arrivalType]}
          </StatusChip>
        </div>
        <div className="detail-list">
          <StateRow label="Vendor Batch" value={batch ? <Link className="text-link" to={`/vendor-batches/${batch.id}`}>{batch.id} →</Link> : '—'} />
          <StateRow label="Status batch" value={batch ? <StatusChip tone="info">{vendorBatchStatusLabels[batch.status]}</StatusChip> : '—'} />
          <StateRow label="Tipe kedatangan order" value={arrivalTypeLabels[order.goods.arrivalType]} />
          <StateRow label="Tiba di JPA" value={formatDate(order.goods.arrivedAt)} />
          <StateRow
            label="Pemeriksaan pra-kirim"
            detail={order.goods.checkNote ?? undefined}
            value={<StatusChip tone={order.goods.preDeliveryCheckCompleted ? 'success' : order.goods.arrivedAt ? 'warning' : 'neutral'}>{order.goods.preDeliveryCheckCompleted ? 'Selesai' : 'Belum selesai'}</StatusChip>}
          />
          <StateRow label="Checked at" value={formatDate(order.goods.checkedAt)} />
          <StateRow label="Kesiapan distribusi" detail="Dihitung otomatis dari kedatangan + pemeriksaan, bukan delivery sekolah" value={<StatusChip tone={isReadyToDeliver(order) ? 'success' : 'neutral'}>{isReadyToDeliver(order) ? 'Siap didistribusikan' : 'Belum siap'}</StatusChip>} />
        </div>
        {order.stage !== 'CLOSED' && !order.goods.preDeliveryCheckCompleted && order.goods.arrivedAt ? (
          <Button onClick={() => setCheckOpen(true)}>Cek barang selesai</Button>
        ) : null}
        {order.stage !== 'CLOSED' && !order.goods.arrivedAt && batch ? (
          <Link className="button button--secondary button--md" to={`/vendor-batches/${batch.id}`}>Kelola alokasi kedatangan</Link>
        ) : null}
      </section>

      <section className="workspace-panel tracker-summary-panel">
        <div className="panel-heading">
          <div>
            <h2>Cache Kelengkapan Buku Tracker</h2>
            <p>Ringkasan whole-order saja. Rekonsiliasi judul dan delivery detail tetap di tracker eksternal.</p>
          </div>
          <StatusChip tone={fulfillment.syncStatus === 'OK' ? 'success' : fulfillment.syncStatus === 'ERROR' ? 'danger' : 'warning'}>
            Sync {fulfillment.syncStatus}
          </StatusChip>
        </div>

        <div className="tracker-identity">
          <div><span>Tracker Order ID</span><strong>{fulfillment.trackerOrderId}</strong></div>
          <a className="button button--secondary button--sm" href={fulfillment.trackerUrl} target="_blank" rel="noreferrer">Open Kelengkapan Tracker ↗</a>
        </div>

        <div className="progress-block">
          <div className="progress-block__head"><span>Whole school order</span><strong>{fulfillment.deliveredQty} / {fulfillment.orderedQty} buku</strong></div>
          <div className="progress-track"><span style={{ width: `${fulfillment.progressPercent}%` }} /></div>
        </div>
        <div className="fulfillment-quantity-grid">
          <div><span>Ordered</span><strong>{fulfillment.orderedQty}</strong></div>
          <div><span>Delivered kumulatif</span><strong>{fulfillment.deliveredQty}</strong></div>
          <div className={fulfillment.remainingQty > 0 ? 'is-warning' : ''}><span>Remaining whole order</span><strong>{fulfillment.remainingQty}</strong></div>
          <div><span>Masalah tracker</span><strong>{fulfillment.problemCount}</strong></div>
        </div>
        <p className="tracker-semantics-note">Delivery tanpa discrepancy hanya memastikan delivery itu sesuai—bukan berarti seluruh order selesai. Remaining selalu ordered − delivered.</p>
        <div className="detail-list">
          <StateRow label="Snapshot terakhir" value={formatDate(fulfillment.lastUpdated)} />
          <StateRow label="Percobaan sync terakhir" value={fulfillment.lastSyncAttemptAt ? formatDateTime(fulfillment.lastSyncAttemptAt) : '—'} />
          {fulfillment.syncMessage ? <StateRow label="Pesan sync" value={fulfillment.syncMessage} /> : null}
        </div>
        {order.stage !== 'CLOSED' ? (
          <div className="tracker-refresh-controls">
            <FormField label="Hasil simulasi refresh" htmlFor={`tracker-outcome-${order.id}`} hint="Prototype deterministic; tidak melakukan request jaringan.">
              <select id={`tracker-outcome-${order.id}`} value={refreshOutcome} onChange={(event) => setRefreshOutcome(event.target.value as MockTrackerOutcome)}>
                <option value="SUCCESS">Successful sync</option>
                <option value="STALE">Stale snapshot</option>
                <option value="ERROR">Connection error</option>
              </select>
            </FormField>
            <Button variant="secondary" onClick={refresh}>Refresh summary</Button>
          </div>
        ) : (
          <p className="readonly-workflow-note">Order sudah CLOSED. Cache tracker ditampilkan sebagai konteks read-only.</p>
        )}
      </section>

      <section className="workspace-panel school-acceptance-panel">
        <div>
          <h2>Penerimaan sekolah</h2>
          <p>Dicatat hanya setelah tracker menunjukkan seluruh order 100%. Tidak mengubah pembayaran atau benefit.</p>
        </div>
        <div className="school-acceptance-panel__action">
          <StatusChip tone={order.goods.acceptedBySchoolAt ? 'success' : 'neutral'}>{order.goods.acceptedBySchoolAt ? `Diterima ${formatDate(order.goods.acceptedBySchoolAt)}` : 'Belum diterima'}</StatusChip>
          {canAccept ? <Button onClick={() => run(() => recordSchoolAcceptance(order.id), 'Penerimaan seluruh order oleh sekolah dicatat.')}>Catat diterima sekolah</Button> : null}
        </div>
      </section>

      <Modal
        open={checkOpen}
        title="Selesaikan pemeriksaan barang"
        description="Ini hanya pemeriksaan pra-kirim di JPA; tidak menandai buku sudah dikirim atau diterima sekolah."
        onClose={() => setCheckOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setCheckOpen(false)}>Batal</Button><Button type="submit" form="goods-check-form">Cek barang selesai</Button></>}
      >
        <form id="goods-check-form" className="form-stack" onSubmit={submitCheck}>
          <FormField label="Catatan singkat" htmlFor="goods-check-note" hint="Opsional.">
            <textarea id="goods-check-note" value={checkNote} onChange={(event) => setCheckNote(event.target.value)} rows={3} placeholder="Contoh: jumlah kardus sesuai surat jalan" />
          </FormField>
        </form>
      </Modal>
    </div>
  )
}
