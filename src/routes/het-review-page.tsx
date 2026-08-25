import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PRODUCT_MASTER } from '../data/product-master'
import { searchProductMaster } from '../domain/intake'
import { deriveActionCandidates, derivePrimaryNextAction } from '../domain/next-action'
import { getHetExceptionCount } from '../domain/order-state'
import { calculateReviewedHetAmount } from '../domain/transitions'
import type { OrderItem } from '../domain/types'
import { usePrototypeStore } from '../store/use-prototype-store'
import { formatCurrency, formatDateTime } from '../utils/format'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { ExceptionIndicator } from '../components/ui/exception-indicator'
import { FormField } from '../components/ui/form-field'
import { StatusChip } from '../components/ui/status-chip'

type EditorMode = 'ACTIONS' | 'PRODUCT' | 'MANUAL'

function exceptionLabel(status: OrderItem['matchStatus']): string {
  switch (status) {
    case 'PRICE_MISMATCH': return 'Harga berbeda'
    case 'AMBIGUOUS_MATCH': return 'Match ambigu'
    case 'NO_MATCH': return 'Tidak ada match'
    default: return status.replaceAll('_', ' ')
  }
}

export function HetReviewPage() {
  const { orderId } = useParams()
  const order = usePrototypeStore((state) => orderId ? state.orders[orderId] : undefined)
  const acceptSuggestion = usePrototypeStore((state) => state.acceptHetSuggestion)
  const chooseProduct = usePrototypeStore((state) => state.chooseHetProduct)
  const manualOverride = usePrototypeStore((state) => state.manualOverrideHet)
  const confirmHet = usePrototypeStore((state) => state.confirmHet)
  const reopenHet = usePrototypeStore((state) => state.reopenHet)
  const [editor, setEditor] = useState<{ itemId: string; mode: EditorMode } | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [reopenError, setReopenError] = useState('')
  const [formError, setFormError] = useState('')
  const [renderedAt] = useState(() => new Date())

  const unresolvedItems = useMemo(
    () => order?.items.filter((item) => ['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(item.matchStatus)) ?? [],
    [order],
  )
  const resolvedItems = useMemo(
    () => order?.items.filter((item) => item.matchStatus === 'MATCHED' || item.matchStatus === 'MANUAL_OVERRIDE') ?? [],
    [order],
  )

  if (!order) {
    return <EmptyState title="Order tidak ditemukan" description="Order HET tidak tersedia pada demo state." action={<Link className="button button--secondary button--md" to="/orders">Kembali ke Pesanan</Link>} />
  }

  const openEditor = (item: OrderItem, mode: EditorMode) => {
    setEditor({ itemId: item.id, mode })
    setProductQuery(mode === 'PRODUCT' ? (item.productCode ?? item.arkasTitle) : '')
    setManualReason('')
    setManualPrice(String(item.hetUnitPrice ?? item.arkasUnitPrice))
    setFormError('')
  }

  const submitManualOverride = (event: FormEvent<HTMLFormElement>, item: OrderItem) => {
    event.preventDefault()
    try {
      manualOverride(order.id, item.id, {
        reviewedUnitPrice: Number(manualPrice),
        reason: manualReason,
      })
      setEditor(null)
      setFormError('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Manual override gagal.')
    }
  }

  const confirmReview = () => {
    try {
      confirmHet(order.id)
      setFormError('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'HET review belum dapat dikonfirmasi.')
    }
  }

  const reopenReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      reopenHet(order.id, reopenReason)
      setReopenError('')
      setReopenReason('')
    } catch (error) {
      setReopenError(error instanceof Error ? error.message : 'HET review belum dapat dibuka kembali.')
    }
  }

  if (order.het.status === 'APPROVED') {
    const primary = derivePrimaryNextAction(
      deriveActionCandidates(order, { vendorBatch: null }, renderedAt),
    )
    return (
      <div className="page-stack focused-route">
        <Link className="back-link" to={`/orders/${order.id}`}>← Order Workspace</Link>
        <section className="workflow-success">
          <div className="workflow-success__mark">✓</div>
          <div>
            <p className="eyebrow">HET Review selesai</p>
            <h1>Review HET dikonfirmasi</h1>
            <p>{order.schoolName} · {order.id}</p>
          </div>
        </section>
        <section className="workspace-panel">
          <div className="totals-strip totals-strip--four">
            <div><span>Anggaran ARKAS</span><strong>{formatCurrency(order.arkasBudgetAmount)}</strong></div>
            <div><span>Hasil review HET</span><strong>{order.hetReviewedAmount === null ? '—' : formatCurrency(order.hetReviewedAmount)}</strong></div>
            <div><span>Invoice final</span><strong>{order.finalInvoiceAmount === null ? '—' : formatCurrency(order.finalInvoiceAmount)}</strong></div>
            <div><span>Selisih</span><strong>{order.hetReviewedAmount === null ? '—' : formatCurrency(Math.abs(order.hetReviewedAmount - order.arkasBudgetAmount))}</strong></div>
          </div>
          <div className="callout callout--success">
            Konfirmasi HET menetapkan <strong>reviewed HET</strong>. Nominal final SIPLah / invoice masih menunggu konfirmasi transaksi; nilai ARKAS sumber tidak berubah.
          </div>
          <div className="workflow-next-step">
            <div><span>Next Action</span><strong>{primary?.title ?? 'Lanjutkan SIPLah'}</strong></div>
            <Link className="button button--primary button--md" to={`/orders/${order.id}/siplah`}>Lanjut ke SIPLah</Link>
          </div>
        </section>
        {order.siplah.orderPlaced ? (
          <section className="callout callout--info">
            <strong>Review HET tidak dapat dibuka kembali langsung.</strong> Order SIPLah sudah dibuat; koreksi setelah titik ini membutuhkan alur koreksi atau pembatalan berikutnya yang belum menjadi bagian prototype.
          </section>
        ) : (
          <section className="workspace-panel het-reopen-panel">
            <div className="panel-heading">
              <div><h2>Buka kembali review HET</h2><p>Dapat dilakukan sebelum order SIPLah dibuat. Alasan operator wajib dicatat dan approval sebelumnya akan dihapus.</p></div>
              <StatusChip tone="warning">Koreksi sebelum SIPLah</StatusChip>
            </div>
            <form className="inline-action-form" onSubmit={reopenReview}>
              <FormField label="Alasan wajib" htmlFor="het-reopen-reason">
                <textarea id="het-reopen-reason" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Contoh: sekolah mengirim harga ARKAS terbaru." rows={3} required />
              </FormField>
              <Button variant="secondary" type="submit">Buka kembali review HET</Button>
            </form>
            {reopenError ? <div className="callout callout--danger">{reopenError}</div> : null}
          </section>
        )}
      </div>
    )
  }

  const reviewedPreview = unresolvedItems.length === 0
    ? calculateReviewedHetAmount(order.items)
    : null
  const productResults = searchProductMaster(productQuery, PRODUCT_MASTER)

  return (
    <div className="page-stack focused-route het-review-page">
      <Link className="back-link" to={`/orders/${order.id}`}>← Order Workspace</Link>
      <header className="focused-route__header">
        <div>
          <p className="eyebrow">TASK 07 · Exception-first HET</p>
          <h1>Review Selisih HET</h1>
          <p>{order.schoolName} · {order.id} · {order.arkas.reference}</p>
        </div>
        <StatusChip tone={unresolvedItems.length > 0 ? 'danger' : 'success'}>
          {unresolvedItems.length > 0 ? `${unresolvedItems.length} perlu keputusan` : 'Siap dikonfirmasi'}
        </StatusChip>
      </header>

      <section className="exception-summary exception-summary--workflow">
        <div><strong>{order.het.detectedItemCount}</strong><span>item terdeteksi</span></div>
        <div><strong>{order.het.autoMatchedItemCount}</strong><span>cocok otomatis</span></div>
        <div className={unresolvedItems.length > 0 ? 'is-warning' : ''}><strong>{unresolvedItems.length}</strong><span>perlu review</span></div>
      </section>

      {unresolvedItems.length > 0 ? (
        <section className="exception-worklist" aria-label="HET exceptions">
          <div className="section-heading">
            <div><h2>Keputusan operator</h2><p>Item normal disembunyikan; fokus hanya pada exception.</p></div>
            <ExceptionIndicator label={`${unresolvedItems.length} blocker sebelum SIPLah`} level="danger" />
          </div>
          {unresolvedItems.map((item) => {
            const difference = item.hetUnitPrice === null ? null : item.hetUnitPrice - item.arkasUnitPrice
            const editorOpen = editor?.itemId === item.id
            return (
              <article className="het-exception-card" key={item.id}>
                <div className="het-exception-card__head">
                  <div>
                    <ExceptionIndicator label={exceptionLabel(item.matchStatus)} level={item.matchStatus === 'PRICE_MISMATCH' ? 'danger' : 'warning'} />
                    <h2>{item.arkasTitle}</h2>
                    <p>{item.matchReason} {item.matchConfidence !== null ? `Confidence ${Math.round(item.matchConfidence * 100)}%.` : ''}</p>
                  </div>
                  <StatusChip tone="neutral">Qty {item.quantity}</StatusChip>
                </div>

                <div className="het-comparison">
                  <div>
                    <span>Sumber ARKAS · immutable</span>
                    <strong>{item.arkasTitle}</strong>
                    <p>{item.quantity} × {formatCurrency(item.arkasUnitPrice)}</p>
                  </div>
                  <div className={!item.masterProductTitle ? 'is-empty' : ''}>
                    <span>Suggested Product Master</span>
                    <strong>{item.masterProductTitle ?? 'Belum ada suggested match'}</strong>
                    <p>{item.productCode ?? '—'} · {item.hetUnitPrice === null ? 'Harga belum ada' : formatCurrency(item.hetUnitPrice)}</p>
                  </div>
                  <div>
                    <span>Selisih per item</span>
                    <strong className={difference && difference !== 0 ? 'text-danger' : ''}>{difference === null ? '—' : formatCurrency(Math.abs(difference))}</strong>
                    <p>{difference === null ? 'Pilih produk atau override' : difference > 0 ? 'HET lebih tinggi' : difference < 0 ? 'HET lebih rendah' : 'Harga sama'}</p>
                  </div>
                </div>

                <div className="het-exception-card__actions">
                  {item.productCode && item.hetUnitPrice !== null ? (
                    <Button size="sm" onClick={() => acceptSuggestion(order.id, item.id)}>
                      {item.matchStatus === 'PRICE_MISMATCH' ? `Gunakan HET ${formatCurrency(item.hetUnitPrice)}` : 'Terima suggested match'}
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => openEditor(item, 'PRODUCT')}>Pilih produk lain</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditor(item, 'MANUAL')}>Manual override</Button>
                </div>

                {editorOpen && editor.mode === 'PRODUCT' ? (
                  <div className="inline-editor">
                    <FormField label="Cari Product Master" htmlFor={`product-search-${item.id}`} hint="Cari dengan judul atau kode produk.">
                      <input id={`product-search-${item.id}`} value={productQuery} onChange={(event) => setProductQuery(event.target.value)} autoFocus />
                    </FormField>
                    <div className="product-search-results">
                      {productResults.length > 0 ? productResults.map((product) => (
                        <button
                          type="button"
                          key={product.code}
                          onClick={() => {
                            chooseProduct(order.id, item.id, product)
                            setEditor(null)
                          }}
                        >
                          <span><strong>{product.title}</strong><small>{product.code}</small></span>
                          <span>{formatCurrency(product.hetUnitPrice)}</span>
                          <b>Pilih {product.code}</b>
                        </button>
                      )) : <p>Tidak ada produk yang cocok dengan pencarian.</p>}
                    </div>
                  </div>
                ) : null}

                {editorOpen && editor.mode === 'MANUAL' ? (
                  <form className="inline-editor form-stack" onSubmit={(event) => submitManualOverride(event, item)}>
                    <div className="form-grid">
                      <FormField label="Harga review per item" htmlFor={`manual-price-${item.id}`}>
                        <input id={`manual-price-${item.id}`} type="number" min="1" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} required />
                      </FormField>
                      <FormField label="Alasan wajib" htmlFor={`manual-reason-${item.id}`}>
                        <input id={`manual-reason-${item.id}`} value={manualReason} onChange={(event) => setManualReason(event.target.value)} placeholder="Kenapa tidak memakai Product Master?" required />
                      </FormField>
                    </div>
                    {formError ? <p className="form-error">{formError}</p> : null}
                    <div><Button size="sm" type="submit">Simpan manual override</Button></div>
                  </form>
                ) : null}
              </article>
            )
          })}
        </section>
      ) : (
        <section className="workspace-panel review-ready">
          <div className="workflow-success__mark">✓</div>
          <div><h2>Semua exception sudah diputuskan</h2><p>Status belum APPROVED. Periksa total lalu konfirmasi secara eksplisit.</p></div>
        </section>
      )}

      <details className="matched-items-disclosure">
        <summary>{resolvedItems.length} item berhasil dicocokkan · buka bila perlu inspeksi atau koreksi</summary>
        <div>
          {resolvedItems.map((item) => {
            const editorOpen = editor?.itemId === item.id
            return (
              <article key={item.id}>
                <div className="matched-item-summary">
                  <span><strong>{item.arkasTitle}</strong><small>ARKAS immutable · {item.quantity} × {formatCurrency(item.arkasUnitPrice)}</small></span>
                  <span><StatusChip tone="success">{item.resolutionType?.replaceAll('_', ' ') ?? 'MATCHED'}</StatusChip><small>{item.masterProductTitle} · {item.hetUnitPrice === null ? 'Harga belum ada' : formatCurrency(item.hetUnitPrice)}</small></span>
                  <Button variant="ghost" size="sm" onClick={() => openEditor(item, 'ACTIONS')}>Edit</Button>
                </div>

                {editorOpen && editor.mode === 'ACTIONS' ? (
                  <div className="matched-item-edit-actions">
                    <div><strong>Koreksi hasil review</strong><small>Nilai ARKAS di atas tetap tidak berubah.</small></div>
                    <Button variant="secondary" size="sm" onClick={() => openEditor(item, 'PRODUCT')}>Pilih produk lain</Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditor(item, 'MANUAL')}>Manual override</Button>
                  </div>
                ) : null}

                {editorOpen && editor.mode === 'PRODUCT' ? (
                  <div className="inline-editor">
                    <FormField label="Cari Product Master" htmlFor={`resolved-product-search-${item.id}`} hint="Pilih produk pengganti; ARKAS tidak akan diubah.">
                      <input id={`resolved-product-search-${item.id}`} value={productQuery} onChange={(event) => setProductQuery(event.target.value)} autoFocus />
                    </FormField>
                    <div className="product-search-results">
                      {productResults.length > 0 ? productResults.map((product) => (
                        <button
                          type="button"
                          key={product.code}
                          onClick={() => {
                            chooseProduct(order.id, item.id, product)
                            setEditor(null)
                          }}
                        >
                          <span><strong>{product.title}</strong><small>{product.code}</small></span>
                          <span>{formatCurrency(product.hetUnitPrice)}</span>
                          <b>Pilih {product.code}</b>
                        </button>
                      )) : <p>Tidak ada produk yang cocok dengan pencarian.</p>}
                    </div>
                  </div>
                ) : null}

                {editorOpen && editor.mode === 'MANUAL' ? (
                  <form className="inline-editor form-stack" onSubmit={(event) => submitManualOverride(event, item)}>
                    <div className="form-grid">
                      <FormField label="Harga review per item" htmlFor={`resolved-manual-price-${item.id}`}>
                        <input id={`resolved-manual-price-${item.id}`} type="number" min="1" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} required />
                      </FormField>
                      <FormField label="Alasan wajib" htmlFor={`resolved-manual-reason-${item.id}`}>
                        <input id={`resolved-manual-reason-${item.id}`} value={manualReason} onChange={(event) => setManualReason(event.target.value)} placeholder="Mengapa hasil review sebelumnya dikoreksi?" required />
                      </FormField>
                    </div>
                    {formError ? <p className="form-error">{formError}</p> : null}
                    <div><Button size="sm" type="submit">Simpan manual override</Button></div>
                  </form>
                ) : null}
              </article>
            )
          })}
        </div>
      </details>

      <section className="het-review-footer">
        <div className="totals-strip">
          <div><span>Anggaran ARKAS</span><strong>{formatCurrency(order.arkasBudgetAmount)}</strong></div>
          <div><span>Preview HET review</span><strong>{reviewedPreview === null ? 'Selesaikan exception' : formatCurrency(reviewedPreview)}</strong></div>
          <div className={reviewedPreview !== null && reviewedPreview !== order.arkasBudgetAmount ? 'is-warning' : ''}>
            <span>Selisih</span><strong>{reviewedPreview === null ? '—' : formatCurrency(Math.abs(reviewedPreview - order.arkasBudgetAmount))}</strong>
          </div>
        </div>
        <div className="het-review-footer__confirm">
          <div>
            <strong>Konfirmasi tidak otomatis.</strong>
            <span>Approval membekukan hasil reviewed HET. Nominal final SIPLah / invoice baru ditetapkan setelah transaksi SIPLah dikonfirmasi.</span>
          </div>
          <Button onClick={confirmReview} disabled={getHetExceptionCount(order) > 0}>Confirm HET Review</Button>
        </div>
        {formError ? <div className="callout callout--danger">{formError}</div> : null}
      </section>

      <section className="workflow-context-strip">
        <span>Event terakhir</span>
        <strong>{order.timeline[0]?.title}</strong>
        <small>{order.timeline[0] ? formatDateTime(order.timeline[0].occurredAt) : '—'}</small>
      </section>
    </div>
  )
}
