import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deriveWorkQueue,
  getOrderActionCandidates,
  getOrderBatch,
  getOrders,
} from '../domain/selectors'
import { derivePrimaryNextAction } from '../domain/next-action'
import { usePrototypeStore } from '../store/use-prototype-store'
import { futureIsoDate } from '../utils/format'
import { OrderSummaryRow } from '../components/orders/order-summary-row'
import { EmptyState } from '../components/ui/empty-state'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'
import { NextActionPanel } from '../components/work-queue/next-action-panel'

export function HomePage() {
  const orders = usePrototypeStore((state) => state.orders)
  const vendorBatches = usePrototypeStore((state) => state.vendorBatches)
  const snoozeNextAction = usePrototypeStore((state) => state.snoozeNextAction)
  const [renderedAt] = useState(() => new Date())
  const queue = useMemo(
    () => deriveWorkQueue({ orders, vendorBatches }, renderedAt),
    [orders, renderedAt, vendorBatches],
  )
  const activeOrders = useMemo(
    () =>
      getOrders({ orders })
        .filter((order) => order.stage !== 'CLOSED')
        .sort((a, b) => {
          const aPriority = derivePrimaryNextAction(
            getOrderActionCandidates(a, vendorBatches, renderedAt),
          )?.priority ?? 999
          const bPriority = derivePrimaryNextAction(
            getOrderActionCandidates(b, vendorBatches, renderedAt),
          )?.priority ?? 999
          return aPriority - bPriority
        })
        .slice(0, 5),
    [orders, renderedAt, vendorBatches],
  )
  const snoozedCount = Object.values(orders).reduce(
    (count, order) => count + Object.values(order.nextActionControl.controlsByActionKey).filter(
      (control) =>
        control?.snoozedUntil &&
        new Date(control.snoozedUntil).getTime() > renderedAt.getTime(),
    ).length,
    0,
  )

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Ruang kerja hari ini"
        title="Kerjakan Sekarang"
        description="Pekerjaan penting diurutkan dari blocker dan aksi yang paling siap diselesaikan."
        actions={
          <Link className="button button--secondary button--sm" to="/orders?filter=needs-action">
            Semua yang perlu tindakan
          </Link>
        }
      />

      <section className="section-block" aria-labelledby="work-queue-title">
        <div className="section-heading">
          <div>
            <h2 id="work-queue-title">Prioritas operasional</h2>
            <p>{queue.length} pekerjaan aktif dari state demo saat ini.</p>
          </div>
          {snoozedCount > 0 ? <StatusChip tone="info">{snoozedCount} disnooze</StatusChip> : null}
        </div>

        {queue.length > 0 ? (
          <div className="work-queue">
            {queue.map((item) => (
              <NextActionPanel
                key={item.id}
                action={item}
                schoolName={item.context}
                compact
                onSnooze={() => snoozeNextAction(item.orderIds, item.kind, futureIsoDate(3))}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Queue bersih"
            description="Tidak ada next action aktif. Periksa kembali item yang disnooze atau pesanan selesai."
            action={<Link className="button button--secondary button--md" to="/orders">Buka semua pesanan</Link>}
          />
        )}
      </section>

      <section className="section-block" aria-labelledby="active-orders-title">
        <div className="section-heading">
          <div>
            <h2 id="active-orders-title">Pesanan Aktif</h2>
            <p>Konteks ringkas untuk berpindah sekolah tanpa mengingat statusnya.</p>
          </div>
          <Link className="text-link" to="/orders">Lihat semua →</Link>
        </div>
        <div className="order-summary-list">
          {activeOrders.map((order) => (
            <OrderSummaryRow
              key={order.id}
              order={order}
              batch={getOrderBatch(order, vendorBatches)}
              now={renderedAt}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
