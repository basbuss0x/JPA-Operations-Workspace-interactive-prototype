import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildVendorRecap,
  getVendorBatchOperationalState,
  getVendorBatchOrders,
} from '../domain/selectors'
import { vendorBatchStatusLabels } from '../domain/presentation'
import type { VendorBatch } from '../domain/types'
import { usePrototypeStore } from '../store/use-prototype-store'
import { formatDate } from '../utils/format'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'

function statusTone(status: VendorBatch['status']): 'neutral' | 'info' | 'success' | 'warning' {
  if (status === 'ARRIVED') return 'success'
  if (status === 'DRAFT' || status === 'PARTIALLY_ARRIVED') return 'warning'
  if (status === 'RECAP_GENERATED') return 'info'
  return 'neutral'
}

export function VendorBatchesPage() {
  const batches = usePrototypeStore((state) => state.vendorBatches)
  const orders = usePrototypeStore((state) => state.orders)
  const [renderedAt] = useState(() => new Date())
  const rows = useMemo(
    () => Object.values(batches)
      .map((batch) => {
        const memberOrders = getVendorBatchOrders(batch, orders)
        let recap = null
        let error: string | null = null
        try {
          recap = buildVendorRecap(memberOrders)
        } catch (caught) {
          error = caught instanceof Error ? caught.message : 'Rekap tidak valid.'
        }
        return { batch, recap, error, operation: getVendorBatchOperationalState(batch, renderedAt) }
      })
      .sort((a, b) =>
        a.operation.priority - b.operation.priority ||
        b.batch.createdAt.localeCompare(a.batch.createdAt),
      ),
    [batches, orders, renderedAt],
  )

  return (
    <div className="page-stack vendor-batches-page">
      <PageHeader
        eyebrow="Operasional vendor"
        title="Vendor Batch"
        description="Urutan kerja operasional: batch yang perlu tindakan muncul lebih dulu, tanpa metrik dashboard yang tidak membantu eksekusi."
        actions={<Link className="button button--primary button--md" to="/vendor-batches/new">Buat Vendor Batch</Link>}
      />

      <section className="section-block" aria-labelledby="vendor-work-title">
        <div className="section-heading">
          <div><h2 id="vendor-work-title">Batch yang perlu dikerjakan</h2><p>Jawaban singkat untuk status recap, pengiriman, dan tindak lanjut vendor.</p></div>
          <StatusChip>{rows.length} batch</StatusChip>
        </div>
        <div className="vendor-batch-list">
          {rows.map(({ batch, recap, error, operation }) => (
            <article className="vendor-batch-row" key={batch.id}>
              <div className="vendor-batch-row__identity">
                <Link to={`/vendor-batches/${batch.id}`}>{batch.id}</Link>
                <span>Dibuat {formatDate(batch.createdAt)}</span>
              </div>
              <div className="vendor-batch-row__status">
                <StatusChip tone={statusTone(batch.status)} dot>{vendorBatchStatusLabels[batch.status]}</StatusChip>
                <small>{batch.recapGeneratedAt ? `Rekap ${batch.recapGenerationCount}×` : 'Rekap belum dibuat'}</small>
              </div>
              {recap ? (
                <div className="vendor-batch-row__counts">
                  <span><strong>{recap.schoolCount}</strong> sekolah</span>
                  <span><strong>{recap.distinctProductCount}</strong> produk</span>
                  <span><strong>{recap.totalQuantity}</strong> buku</span>
                </div>
              ) : <div className="form-error">{error}</div>}
              <div className={operation.actionable ? 'vendor-next-step is-actionable' : 'vendor-next-step'}>
                <div><strong>{operation.label}</strong><span>{operation.detail}</span></div>
                <Link className="button button--secondary button--sm" to={`/vendor-batches/${batch.id}`}>Buka batch</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
