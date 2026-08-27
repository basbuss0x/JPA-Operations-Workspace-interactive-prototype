import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { derivePrimaryNextAction, getActiveActionCandidates } from '../domain/next-action'
import {
  derivePipelineColumns,
  getHetExceptionCount,
  getOrderActionCandidates,
  isSiplahAdminComplete,
  isSiplahReadyForVendor,
} from '../domain/selectors'
import { lifecycleLabels } from '../domain/types'
import type { Order, VendorBatch } from '../domain/types'
import { usePrototypeStore } from '../store/use-prototype-store'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'
import type { StatusTone } from '../components/ui/status-chip'

interface PipelineSignal {
  label: string
  tone: StatusTone
}

function getPipelineSignals(order: Order): PipelineSignal[] {
  const signals: PipelineSignal[] = []
  const exceptions = getHetExceptionCount(order)

  if (exceptions > 0) {
    signals.push({ label: `${exceptions} selisih HET`, tone: 'danger' })
  }
  if (order.fulfillment.syncStatus !== 'OK') {
    signals.push({ label: `Tracker ${order.fulfillment.syncStatus}`, tone: 'warning' })
  }
  if (order.goods.arrivedAt && !order.goods.preDeliveryCheckCompleted) {
    signals.push({ label: 'Barang tiba · belum dicek', tone: 'warning' })
  }
  if (order.fulfillment.remainingQty > 0 && order.goods.preDeliveryCheckCompleted) {
    signals.push({ label: `Sisa ${order.fulfillment.remainingQty} buku`, tone: 'warning' })
  }
  if (order.benefit.status === 'ELIGIBLE') {
    signals.push({ label: 'Benefit ELIGIBLE', tone: 'warning' })
  }
  if (order.schoolPayment.status === 'UNPAID' && order.finalInvoiceAmount !== null) {
    signals.push({ label: 'Pembayaran belum dikonfirmasi', tone: 'warning' })
  }
  if (order.het.status === 'APPROVED' && !isSiplahReadyForVendor(order)) {
    signals.push({ label: 'SIPLah procurement belum selesai', tone: 'warning' })
  }
  if (isSiplahReadyForVendor(order) && !isSiplahAdminComplete(order)) {
    signals.push({ label: 'Administrasi SIPLah menyusul', tone: 'info' })
  }

  if (signals.length === 0) {
    signals.push({
      label: order.stage === 'CLOSED' ? 'Order selesai' : 'Tidak ada exception terbuka',
      tone: order.stage === 'CLOSED' ? 'success' : 'neutral',
    })
  }

  return signals.slice(0, 2)
}

function getClearState(order: Order): string {
  if (order.stage === 'CLOSED') return 'Order selesai'
  if (order.stage === 'VENDOR') return 'Menunggu update vendor'
  if (order.stage === 'COMPLETION' && order.schoolPayment.status === 'UNPAID') {
    return 'Menunggu pembayaran sekolah'
  }
  return 'Tidak ada tindakan aktif'
}

function PipelineCard({
  order,
  vendorBatches,
  now,
}: {
  order: Order
  vendorBatches: Record<string, VendorBatch>
  now: Date
}) {
  const action = derivePrimaryNextAction(
    getActiveActionCandidates(getOrderActionCandidates(order, vendorBatches, now)),
  )
  const signals = getPipelineSignals(order)

  return (
    <Link className="pipeline-card" to={`/orders/${order.id}`} data-order-id={order.id}>
      <div className="pipeline-card__header">
        <div>
          <strong>{order.schoolName}</strong>
          <span>{order.id}</span>
        </div>
        <StatusChip tone={order.stage === 'CLOSED' ? 'success' : 'neutral'}>
          {lifecycleLabels[order.stage]}
        </StatusChip>
      </div>
      <div className="pipeline-card__signals">
        {signals.map((signal) => <StatusChip key={signal.label} tone={signal.tone}>{signal.label}</StatusChip>)}
      </div>
      <div className="pipeline-card__action">
        <span>Next Action</span>
        <strong>{action?.title ?? getClearState(order)}</strong>
        {action?.source === 'MANUAL' ? <StatusChip tone="info">Manual override</StatusChip> : null}
        <span className="pipeline-card__arrow" aria-hidden="true">→</span>
      </div>
    </Link>
  )
}

export function PipelinePage() {
  const orders = usePrototypeStore((state) => state.orders)
  const vendorBatches = usePrototypeStore((state) => state.vendorBatches)
  const [showCompleted, setShowCompleted] = useState(false)
  const [renderedAt] = useState(() => new Date())
  const columns = useMemo(
    () => derivePipelineColumns({ orders, vendorBatches }, renderedAt, showCompleted),
    [orders, renderedAt, showCompleted, vendorBatches],
  )
  const activeOrderCount = Object.values(orders).filter((order) => order.stage !== 'CLOSED').length
  const completedOrderCount = Object.values(orders).filter((order) => order.stage === 'CLOSED').length

  return (
    <div className="page-stack pipeline-page">
      <PageHeader
        eyebrow="View sekunder · lintas order"
        title="Pipeline"
        description="Lihat pesanan sekolah tersebar di tahap mana. Posisi di sini diturunkan dari lifecycle order; pekerjaan utama tetap dimulai dari Kerjakan Sekarang."
        actions={
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={showCompleted}
            onClick={() => setShowCompleted((current) => !current)}
          >
            {showCompleted ? 'Sembunyikan selesai' : `Tampilkan selesai (${completedOrderCount})`}
          </Button>
        }
      />

      <div className="pipeline-context-strip" role="status">
        <strong>{activeOrderCount} order aktif</strong>
        <span>Urutkan dari Next Action yang paling perlu dikerjakan; klik kartu untuk membuka workspace order.</span>
        {completedOrderCount > 0 ? (
          <span>{showCompleted ? `${completedOrderCount} order selesai ditampilkan` : `${completedOrderCount} order selesai disembunyikan`}</span>
        ) : null}
      </div>

      <section className="pipeline-board" aria-label="Pipeline lifecycle">
        {columns.map((column) => (
          <section className="pipeline-column" data-stage={column.stage} key={column.stage} aria-labelledby={`pipeline-column-${column.stage}`}>
            <header className="pipeline-column__header">
              <div>
                <h2 id={`pipeline-column-${column.stage}`}>{lifecycleLabels[column.stage]}</h2>
                <span>{column.stage === 'CLOSED' ? 'Selesai' : 'Posisi lifecycle'}</span>
              </div>
              <StatusChip tone={column.stage === 'CLOSED' ? 'success' : 'neutral'}>{column.orders.length}</StatusChip>
            </header>
            <div className="pipeline-column__body">
              {column.orders.length > 0 ? column.orders.map((order) => (
                <PipelineCard key={order.id} order={order} vendorBatches={vendorBatches} now={renderedAt} />
              )) : (
                <EmptyState title="Belum ada order" description="Order akan muncul di sini saat lifecycle masuk tahap ini." />
              )}
            </div>
          </section>
        ))}
      </section>
    </div>
  )
}
