import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { derivePrimaryNextAction, getActiveActionCandidates } from '../domain/next-action'
import { OrderStateSummary } from '../components/orders/order-state-summary'
import { getOrderStateItems } from '../domain/presentation'
import {
  getHetExceptionCount,
  getOrderActionCandidates,
  getOrderBatch,
  getOrders,
  matchesOrderFilter,
  matchesOrderSearch,
  type OrderFilter,
} from '../domain/selectors'
import { lifecycleLabels } from '../domain/types'
import { usePrototypeStore } from '../store/use-prototype-store'
import { EmptyState } from '../components/ui/empty-state'
import { ExceptionIndicator } from '../components/ui/exception-indicator'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'

const filters: Array<{ id: OrderFilter; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'needs-action', label: 'Perlu tindakan' },
  { id: 'het-problem', label: 'Masalah HET' },
  { id: 'ready-siplah', label: 'Siap SIPLah' },
  { id: 'ready-vendor', label: 'Siap Vendor' },
  { id: 'goods-arrived', label: 'Barang tiba' },
  { id: 'unpaid', label: 'Belum dibayar' },
  { id: 'benefit-eligible', label: 'Benefit eligible' },
]

function isOrderFilter(value: string | null): value is OrderFilter {
  return filters.some((filter) => filter.id === value)
}

export function OrdersPage() {
  const orders = usePrototypeStore((state) => state.orders)
  const vendorBatches = usePrototypeStore((state) => state.vendorBatches)
  const [searchParams, setSearchParams] = useSearchParams()
  const [renderedAt] = useState(() => new Date())
  const query = searchParams.get('q') ?? ''
  const requestedFilter = searchParams.get('filter')
  const activeFilter: OrderFilter = isOrderFilter(requestedFilter) ? requestedFilter : 'all'

  const filteredOrders = useMemo(
    () =>
      getOrders({ orders }).filter(
        (order) =>
          matchesOrderSearch(order, query) &&
          matchesOrderFilter(order, activeFilter, vendorBatches, renderedAt),
      ),
    [activeFilter, orders, query, renderedAt, vendorBatches],
  )

  const updateParam = (key: 'q' | 'filter', value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Semua konteks sekolah"
        title="Pesanan"
        description="Cari sekolah atau referensi, lalu lihat masalah penting dan next action tanpa membuka satu per satu."
      />

      <section className="orders-toolbar" aria-label="Cari dan filter pesanan">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Cari pesanan</span>
          <input
            value={query}
            onChange={(event) => updateParam('q', event.target.value)}
            placeholder="Cari sekolah, order ID, SIPLah, atau ARKAS…"
          />
          {query ? (
            <button type="button" aria-label="Hapus pencarian" onClick={() => updateParam('q', '')}>×</button>
          ) : null}
        </label>
        <div className="quick-filters" aria-label="Filter cepat">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={activeFilter === filter.id ? 'filter-chip filter-chip--active' : 'filter-chip'}
              onClick={() => updateParam('filter', filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <div className="result-count">
        <strong>{filteredOrders.length}</strong> pesanan ditemukan
      </div>

      {filteredOrders.length > 0 ? (
        <>
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Sekolah / order</th>
                  <th>Posisi</th>
                  <th>Masalah / next action</th>
                  <th>HET</th>
                  <th>SIPLah</th>
                  <th>Vendor</th>
                  <th>Barang</th>
                  <th>Bayar</th>
                  <th>Benefit</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const batch = getOrderBatch(order, vendorBatches)
                  const candidates = getActiveActionCandidates(
                    getOrderActionCandidates(order, vendorBatches, renderedAt),
                  )
                  const action = derivePrimaryNextAction(candidates)
                  const otherActionCount = Math.max(0, candidates.length - (action ? 1 : 0))
                  const exceptions = getHetExceptionCount(order)
                  const stateItems = getOrderStateItems(order, batch)
                  return (
                    <tr key={order.id}>
                      <td>
                        <Link className="order-link" to={`/orders/${order.id}`}>
                          <strong>{order.schoolName}</strong>
                          <span>{order.id}</span>
                        </Link>
                      </td>
                      <td><StatusChip>{lifecycleLabels[order.stage]}</StatusChip></td>
                      <td className="orders-table__action">
                        {exceptions > 0 ? <ExceptionIndicator label={`${exceptions} selisih HET`} level="danger" /> : null}
                        <Link to={action?.href ?? `/orders/${order.id}`}>
                          {action?.title ?? 'Tidak ada tindakan aktif'}
                        </Link>
                        {otherActionCount > 0 ? <span className="other-action-count">+{otherActionCount} aksi lain</span> : null}
                      </td>
                      {stateItems.slice(0, 3).map((item) => (
                        <td key={item.label}><StatusChip tone={item.tone}>{item.value}</StatusChip></td>
                      ))}
                      <td><span className="table-value">{stateItems[3].value}</span></td>
                      <td><StatusChip tone={stateItems[4].tone}>{stateItems[4].value}</StatusChip></td>
                      <td><StatusChip tone={stateItems[5].tone}>{stateItems[5].value}</StatusChip></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="orders-mobile-list">
            {filteredOrders.map((order) => {
              const batch = getOrderBatch(order, vendorBatches)
              const candidates = getActiveActionCandidates(
                getOrderActionCandidates(order, vendorBatches, renderedAt),
              )
              const action = derivePrimaryNextAction(candidates)
              const otherActionCount = Math.max(0, candidates.length - (action ? 1 : 0))
              const exceptions = getHetExceptionCount(order)
              return (
                <article className="order-mobile-card" key={order.id}>
                  <Link className="order-mobile-card__header" to={`/orders/${order.id}`}>
                    <div>
                      <strong>{order.schoolName}</strong>
                      <span>{order.id}</span>
                    </div>
                    <StatusChip>{lifecycleLabels[order.stage]}</StatusChip>
                  </Link>
                  {exceptions > 0 ? <ExceptionIndicator label={`${exceptions} selisih HET`} level="danger" /> : null}
                  <OrderStateSummary order={order} batch={batch} />
                  <Link className="order-mobile-card__action" to={action?.href ?? `/orders/${order.id}`}>
                    <span>
                      <small>Next Action</small>
                      <strong>{action?.title ?? 'Tidak ada tindakan aktif'}</strong>
                      {otherActionCount > 0 ? <small>+{otherActionCount} aksi lain</small> : null}
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title="Pesanan tidak ditemukan"
          description="Coba ubah kata pencarian atau hapus filter cepat yang aktif."
          action={
            <button className="button button--secondary button--md" type="button" onClick={() => setSearchParams({})}>
              Hapus filter
            </button>
          }
        />
      )}
    </div>
  )
}
