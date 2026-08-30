import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buildVendorRecap, isVendorBatchEligible, proposeVendorBatchId } from '../domain/selectors'
import { hetReviewStatusLabels } from '../domain/presentation'
import { usePrototypeStore } from '../store/use-prototype-store'
import { formatCurrency } from '../utils/format'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'
import { VendorRecapView } from '../features/vendor/vendor-recap-view'

export function VendorBatchBuilderPage() {
  const navigate = useNavigate()
  const orders = usePrototypeStore((state) => state.orders)
  const vendorBatches = usePrototypeStore((state) => state.vendorBatches)
  const createVendorBatch = usePrototypeStore((state) => state.createVendorBatch)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)

  const eligibleOrders = useMemo(
    () => Object.values(orders)
      .filter(isVendorBatchEligible)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'id')),
    [orders],
  )
  const batchId = useMemo(() => proposeVendorBatchId(vendorBatches), [vendorBatches])
  const selectedOrders = selectedOrderIds.flatMap((orderId) => {
    const order = orders[orderId]
    return order ? [order] : []
  })
  const preview = useMemo(() => {
    if (selectedOrders.length === 0) return { recap: null, error: null }
    try {
      return { recap: buildVendorRecap(selectedOrders), error: null }
    } catch (error) {
      return {
        recap: null,
        error: error instanceof Error ? error.message : 'Data item tidak dapat diagregasi.',
      }
    }
  }, [selectedOrders])

  const toggleOrder = (orderId: string) => {
    setSubmitError(null)
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    )
  }

  const submit = () => {
    setSubmitError(null)
    try {
      createVendorBatch(selectedOrderIds, batchId)
      navigate(`/vendor-batches/${batchId}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Vendor Batch gagal dibuat.')
    }
  }

  return (
    <div className="page-stack vendor-builder-page">
      <Link className="back-link" to="/vendor-batches">← Semua Vendor Batch</Link>
      <PageHeader
        eyebrow="Penyusunan Vendor Batch"
        title="Buat Vendor Batch"
        description="Pilih order yang siap masuk Vendor Batch. Ringkasan dan alokasi sekolah dihitung langsung dari item order—tanpa mengisi ulang jumlah."
        actions={
          <div className="batch-id-proposal" aria-label="Usulan ID batch">
            <span>Batch ID</span><strong>{batchId}</strong>
          </div>
        }
      />

      <section className="workspace-panel eligible-orders-panel" aria-labelledby="eligible-orders-title">
        <div className="panel-heading">
          <div>
            <h2 id="eligible-orders-title">Order siap dipilih</h2>
            <p>HET disetujui, tidak ada pengecualian, SIPLah siap untuk Vendor, nominal final tersedia, dan belum masuk batch.</p>
          </div>
          {eligibleOrders.length > 0 ? (
            <div className="selection-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOrderIds(eligibleOrders.map((order) => order.id))}
                disabled={selectedOrderIds.length === eligibleOrders.length}
              >Pilih semua</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrderIds([])} disabled={selectedOrderIds.length === 0}>Hapus pilihan</Button>
            </div>
          ) : null}
        </div>

        {eligibleOrders.length === 0 ? (
          <EmptyState
            title="Belum ada order siap dipilih"
            description="Selesaikan syarat HET dan pembelian SIPLah terlebih dahulu, atau periksa batch yang sudah aktif."
            action={<Link className="button button--secondary button--md" to="/orders?filter=ready-vendor">Periksa pesanan</Link>}
          />
        ) : (
          <div className="eligible-order-list">
            {eligibleOrders.map((order) => {
              const selected = selectedOrderIds.includes(order.id)
              const totalBooks = order.items.reduce((total, item) => total + item.quantity, 0)
              return (
                <label className={selected ? 'eligible-order is-selected' : 'eligible-order'} key={order.id}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleOrder(order.id)}
                    aria-label={`Pilih ${order.schoolName}`}
                  />
                  <div className="eligible-order__main">
                    <div><strong>{order.schoolName}</strong><span>{order.id} · {order.siplah.orderNumber}</span></div>
                    <strong>{formatCurrency(order.finalInvoiceAmount ?? 0)}</strong>
                  </div>
                  <div className="eligible-order__facts">
                    <span>{order.items.length} jenis produk</span>
                    <span>{totalBooks} buku</span>
                    <StatusChip tone="success">HET {hetReviewStatusLabels.APPROVED}</StatusChip>
                    <StatusChip tone="info">SIPLah siap untuk Vendor</StatusChip>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </section>

      {preview.error ? (
        <div className="callout callout--danger" role="alert">
          <strong>Rekap tidak dapat dibuat.</strong> {preview.error} Pilihan ini tidak akan dapat disimpan sebagai batch.
        </div>
      ) : null}

      {preview.recap ? (
        <>
          <VendorRecapView recap={preview.recap} />
          <section className="batch-create-bar">
            <div>
              <span>{selectedOrderIds.length} order dipilih · {preview.recap.schoolCount} sekolah · {preview.recap.totalQuantity} buku</span>
              <strong>{batchId} akan dibuat sebagai draf</strong>
              <small>Membuat Vendor Batch tidak membuat rekap dan tidak berarti sudah dikirim ke vendor.</small>
            </div>
            <Button onClick={submit}>Buat draf Vendor Batch</Button>
          </section>
        </>
      ) : preview.error === null ? (
        <EmptyState
          title="Pilih order untuk melihat rekap"
          description="Pratinjau ringkasan dan rincian sekolah akan berubah langsung saat pilihan ditambah atau dihapus."
        />
      ) : null}

      {submitError ? <div className="form-error" role="alert">{submitError}</div> : null}
    </div>
  )
}
