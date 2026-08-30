import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PRODUCT_MASTER } from '../data/product-master'
import { rankProductAlternatives, searchProductMaster } from '../domain/intake'
import { deriveActionCandidates, derivePrimaryNextAction } from '../domain/next-action'
import { getHetExceptionCount } from '../domain/order-state'
import { hetItemStatusLabels, hetResolutionTypeLabels } from '../domain/presentation'
import { calculateReviewedHetAmount } from '../domain/transitions'
import type { OrderItem, ProductMasterItem } from '../domain/types'
import { usePrototypeStore } from '../store/use-prototype-store'
import { formatCurrency, formatDateTime } from '../utils/format'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { ExceptionIndicator } from '../components/ui/exception-indicator'
import { FormField } from '../components/ui/form-field'
import { StatusChip } from '../components/ui/status-chip'

type EditorMode = 'ACTIONS' | 'PRODUCT' | 'MANUAL'

interface ManualFieldErrors {
  price?: string
  reason?: string
}

interface HetProductPickerProps {
  item: OrderItem
  inputId: string
  query: string
  hint: string
  onQueryChange: (query: string) => void
  onChoose: (product: ProductMasterItem) => void
}

function exceptionLabel(status: OrderItem['matchStatus']): string {
  return hetItemStatusLabels[status]
}

function HetProductPicker({
  item,
  inputId,
  query,
  hint,
  onQueryChange,
  onChoose,
}: HetProductPickerProps) {
  const hasQuery = query.trim().length > 0
  const currentCode = item.productCode
  const currentLabel = item.resolutionType === null ? 'Saran saat ini' : 'Produk saat ini'
  const hasCurrentProduct = Boolean(item.masterProductTitle && currentCode && item.hetUnitPrice !== null)
  const products = hasQuery
    ? searchProductMaster(query, PRODUCT_MASTER)
    : rankProductAlternatives(item, PRODUCT_MASTER)
        .filter((product) => product.code !== currentCode)
        .slice(0, 4)

  return (
    <div className="product-picker">
      <FormField label="Cari Product Master" htmlFor={inputId} hint={hint}>
        <input id={inputId} value={query} onChange={(event) => onQueryChange(event.target.value)} autoFocus />
      </FormField>

      {!hasQuery && hasCurrentProduct ? (
        <div className="product-picker__current" aria-label={`${currentLabel}: ${item.masterProductTitle}`}>
          <div>
            <span>{currentLabel}</span>
            <strong>{item.masterProductTitle}</strong>
            <small>{currentCode}</small>
            <small>HET {formatCurrency(item.hetUnitPrice ?? 0)}</small>
          </div>
          <small>ARKAS {formatCurrency(item.arkasUnitPrice)} sebagai pembanding</small>
        </div>
      ) : null}

      {!hasQuery ? <p className="product-picker__section-label">Alternatif yang disarankan</p> : null}
      <div className="product-search-results" aria-label={hasQuery ? 'Hasil pencarian produk' : 'Alternatif produk yang disarankan'}>
        {products.length > 0 ? products.map((product) => (
          <button
            type="button"
            key={product.code}
            className={product.code === currentCode ? 'is-current' : ''}
            onClick={() => onChoose(product)}
          >
            <span>
              <strong>{product.title}</strong>
              <small>{product.code}</small>
            </span>
            <span>HET {formatCurrency(product.hetUnitPrice)}</span>
            <b>{product.code === currentCode ? 'Produk saat ini' : `Pilih ${product.code}`}</b>
          </button>
        )) : (
          <div className="product-search-empty">
            <p>Tidak ada produk yang cocok dengan pencarian. Hapus kata pencarian atau cari dengan judul/kode Product Master.</p>
            <Button variant="ghost" size="sm" onClick={() => onQueryChange('')}>Hapus pencarian</Button>
          </div>
        )}
      </div>
    </div>
  )
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
  const [reopenActionError, setReopenActionError] = useState('')
  const [manualFieldErrors, setManualFieldErrors] = useState<ManualFieldErrors>({})
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
    setProductQuery('')
    setManualReason('')
    setManualPrice(String(item.hetUnitPrice ?? item.arkasUnitPrice))
    setManualFieldErrors({})
    setFormError('')
  }

  const submitManualOverride = (event: FormEvent<HTMLFormElement>, item: OrderItem) => {
    event.preventDefault()
    setManualFieldErrors({})
    setFormError('')
    const nextErrors: ManualFieldErrors = {}
    const price = Number(manualPrice)
    if (!manualPrice.trim()) nextErrors.price = 'Harga review per item wajib diisi.'
    else if (!Number.isFinite(price) || price <= 0) nextErrors.price = 'Harga review per item harus berupa angka lebih dari nol.'
    if (!manualReason.trim()) nextErrors.reason = 'Alasan penyesuaian manual wajib diisi.'
    if (nextErrors.price || nextErrors.reason) {
      setManualFieldErrors(nextErrors)
      const fieldPrefix = resolvedItems.some((candidate) => candidate.id === item.id) ? 'resolved-manual' : 'manual'
      document.getElementById(nextErrors.price ? `${fieldPrefix}-price-${item.id}` : `${fieldPrefix}-reason-${item.id}`)?.focus()
      return
    }
    try {
      manualOverride(order.id, item.id, {
        reviewedUnitPrice: price,
        reason: manualReason.trim(),
      })
      setEditor(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Penyesuaian manual gagal.')
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
    setReopenError('')
    setReopenActionError('')
    const trimmedReason = reopenReason.trim()
    if (!trimmedReason) {
      const message = 'Alasan membuka kembali HET wajib diisi.'
      setReopenError(message)
      document.getElementById('het-reopen-reason')?.focus()
      return
    }
    try {
      reopenHet(order.id, trimmedReason)
      setReopenReason('')
    } catch (error) {
      setReopenActionError(error instanceof Error ? error.message : 'HET review belum dapat dibuka kembali.')
    }
  }

  if (order.het.status === 'APPROVED') {
    const primary = derivePrimaryNextAction(
      deriveActionCandidates(order, { vendorBatch: null }, renderedAt),
    )
    return (
      <div className="page-stack focused-route">
        <Link className="back-link" to={`/orders/${order.id}`}>← Ruang kerja order</Link>
        <section className="workflow-success">
          <div className="workflow-success__mark">✓</div>
          <div>
            <p className="eyebrow">Review HET selesai</p>
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
            Konfirmasi HET menetapkan <strong>hasil review HET</strong>. Nominal final SIPLah / Invoice masih menunggu konfirmasi transaksi; nilai sumber ARKAS tidak berubah.
          </div>
          <div className="workflow-next-step">
            <div><span>Next Action</span><strong>{primary?.title ?? 'Lanjutkan SIPLah'}</strong></div>
            <Link className="button button--primary button--md" to={`/orders/${order.id}/siplah`}>Lanjut ke SIPLah</Link>
          </div>
        </section>
        {order.siplah.orderPlaced ? (
          <section className="callout callout--info">
            <strong>Review HET tidak dapat dibuka kembali langsung.</strong> Order SIPLah sudah dibuat; koreksi setelah titik ini membutuhkan alur koreksi atau pembatalan berikutnya yang belum menjadi bagian prototipe.
          </section>
        ) : (
          <section className="workspace-panel het-reopen-panel">
            <div className="panel-heading">
              <div><h2>Buka kembali review HET</h2><p>Dapat dilakukan sebelum order SIPLah dibuat. Alasan operator wajib dicatat dan persetujuan sebelumnya akan dihapus.</p></div>
              <StatusChip tone="warning">Koreksi sebelum SIPLah</StatusChip>
            </div>
            <form className="inline-action-form" onSubmit={reopenReview} noValidate>
              <FormField label="Alasan wajib" htmlFor="het-reopen-reason" error={reopenError || undefined}>
                <textarea
                  id="het-reopen-reason"
                  value={reopenReason}
                  onChange={(event) => {
                    setReopenReason(event.target.value)
                    setReopenError('')
                    setReopenActionError('')
                  }}
                  aria-invalid={Boolean(reopenError)}
                  aria-describedby={reopenError ? 'het-reopen-reason-error' : undefined}
                  placeholder="Contoh: sekolah mengirim harga ARKAS terbaru."
                  rows={3}
                  required
                />
              </FormField>
              <Button variant="secondary" type="submit">Buka kembali review HET</Button>
            </form>
            {reopenActionError ? <div className="callout callout--danger" role="alert"><strong>Review HET belum dibuka kembali.</strong> {reopenActionError}</div> : null}
          </section>
        )}
      </div>
    )
  }

  const reviewedPreview = unresolvedItems.length === 0
    ? calculateReviewedHetAmount(order.items)
    : null
  return (
    <div className="page-stack focused-route het-review-page">
      <Link className="back-link" to={`/orders/${order.id}`}>← Ruang kerja order</Link>
      <header className="focused-route__header">
        <div>
          <p className="eyebrow">Review pengecualian HET</p>
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
        <section className="exception-worklist" aria-label="Pengecualian HET">
          <div className="section-heading">
            <div><h2>Keputusan operator</h2><p>Item normal disembunyikan; fokus hanya pada pengecualian.</p></div>
            <ExceptionIndicator label={`${unresolvedItems.length} penghambat sebelum SIPLah`} level="danger" />
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
                    <p>{item.matchReason} {item.matchConfidence !== null ? `Keyakinan pencocokan ${Math.round(item.matchConfidence * 100)}%.` : ''}</p>
                  </div>
                  <StatusChip tone="neutral">Jumlah {item.quantity}</StatusChip>
                </div>

                <div className="het-comparison">
                  <div>
                    <span>Sumber ARKAS · tetap</span>
                    <strong>{item.arkasTitle}</strong>
                    <p>{item.quantity} × {formatCurrency(item.arkasUnitPrice)}</p>
                  </div>
                  <div className={!item.masterProductTitle ? 'is-empty' : ''}>
                    <span>Saran Product Master</span>
                    <strong>{item.masterProductTitle ?? 'Belum ada saran kecocokan'}</strong>
                    <p>{item.productCode ?? '—'} · {item.hetUnitPrice === null ? 'Harga belum ada' : formatCurrency(item.hetUnitPrice)}</p>
                  </div>
                  <div>
                    <span>Selisih per item</span>
                    <strong className={difference && difference !== 0 ? 'text-danger' : ''}>{difference === null ? '—' : formatCurrency(Math.abs(difference))}</strong>
                    <p>{difference === null ? 'Pilih produk atau lakukan penyesuaian' : difference > 0 ? 'HET lebih tinggi' : difference < 0 ? 'HET lebih rendah' : 'Harga sama'}</p>
                  </div>
                </div>

                <div className="het-exception-card__actions">
                  {item.productCode && item.hetUnitPrice !== null ? (
                    <Button size="sm" onClick={() => acceptSuggestion(order.id, item.id)}>
                      {item.matchStatus === 'PRICE_MISMATCH' ? `Gunakan HET ${formatCurrency(item.hetUnitPrice)}` : 'Terima saran'}
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => openEditor(item, 'PRODUCT')}>Pilih produk lain</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditor(item, 'MANUAL')}>Penyesuaian manual</Button>
                </div>

                {editorOpen && editor.mode === 'PRODUCT' ? (
                  <div className="inline-editor">
                    <HetProductPicker
                      item={item}
                      inputId={`product-search-${item.id}`}
                      query={productQuery}
                      hint="Saran awal tampil sebelum pencarian. Cari dengan judul atau kode untuk hasil lain."
                      onQueryChange={setProductQuery}
                      onChoose={(product) => {
                        chooseProduct(order.id, item.id, product)
                        setEditor(null)
                      }}
                    />
                  </div>
                ) : null}

                {editorOpen && editor.mode === 'MANUAL' ? (
                  <form className="inline-editor form-stack" onSubmit={(event) => submitManualOverride(event, item)} noValidate>
                    <div className="form-grid">
                      <FormField label="Harga review per item" htmlFor={`manual-price-${item.id}`} error={manualFieldErrors.price}>
                        <input
                          id={`manual-price-${item.id}`}
                          type="number"
                          min="1"
                          value={manualPrice}
                          onChange={(event) => {
                            setManualPrice(event.target.value)
                            setManualFieldErrors({})
                            setFormError('')
                          }}
                          aria-invalid={Boolean(manualFieldErrors.price)}
                          aria-describedby={manualFieldErrors.price ? `manual-price-${item.id}-error` : undefined}
                          required
                        />
                      </FormField>
                      <FormField label="Alasan wajib" htmlFor={`manual-reason-${item.id}`} error={manualFieldErrors.reason}>
                        <input
                          id={`manual-reason-${item.id}`}
                          value={manualReason}
                          onChange={(event) => {
                            setManualReason(event.target.value)
                            setManualFieldErrors({})
                            setFormError('')
                          }}
                          aria-invalid={Boolean(manualFieldErrors.reason)}
                          aria-describedby={manualFieldErrors.reason ? `manual-reason-${item.id}-error` : undefined}
                          placeholder="Kenapa tidak memakai Product Master?"
                          required
                        />
                      </FormField>
                    </div>
                    {formError ? <div className="callout callout--danger" role="alert"><strong>Penyesuaian manual belum tersimpan.</strong> {formError}</div> : null}
                    <div><Button size="sm" type="submit">Simpan penyesuaian manual</Button></div>
                  </form>
                ) : null}
              </article>
            )
          })}
        </section>
      ) : (
        <section className="workspace-panel review-ready">
          <div className="workflow-success__mark">✓</div>
          <div><h2>Semua pengecualian sudah diputuskan</h2><p>Status belum disetujui. Periksa total lalu konfirmasi secara eksplisit.</p></div>
        </section>
      )}

      <details className="matched-items-disclosure">
        <summary>{resolvedItems.length} item berhasil dicocokkan · buka bila perlu diperiksa atau dikoreksi</summary>
        <div>
          {resolvedItems.map((item) => {
            const editorOpen = editor?.itemId === item.id
            return (
              <article key={item.id}>
                <div className="matched-item-summary">
                  <span><strong>{item.arkasTitle}</strong><small>Sumber ARKAS tetap · {item.quantity} × {formatCurrency(item.arkasUnitPrice)}</small></span>
                  <span><StatusChip tone="success">{item.resolutionType ? hetResolutionTypeLabels[item.resolutionType] : 'Cocok'}</StatusChip><small>{item.masterProductTitle} · {item.hetUnitPrice === null ? 'Harga belum ada' : formatCurrency(item.hetUnitPrice)}</small></span>
                  <Button variant="ghost" size="sm" onClick={() => openEditor(item, 'ACTIONS')}>Ubah</Button>
                </div>

                {editorOpen && editor.mode === 'ACTIONS' ? (
                  <div className="matched-item-edit-actions">
                    <div><strong>Koreksi hasil review</strong><small>Nilai ARKAS di atas tetap tidak berubah.</small></div>
                    <Button variant="secondary" size="sm" onClick={() => openEditor(item, 'PRODUCT')}>Pilih produk lain</Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditor(item, 'MANUAL')}>Penyesuaian manual</Button>
                  </div>
                ) : null}

                {editorOpen && editor.mode === 'PRODUCT' ? (
                  <div className="inline-editor">
                    <HetProductPicker
                      item={item}
                      inputId={`resolved-product-search-${item.id}`}
                      query={productQuery}
                      hint="Pilih produk pengganti; ARKAS tidak akan diubah. Saran awal tampil sebelum pencarian."
                      onQueryChange={setProductQuery}
                      onChoose={(product) => {
                        chooseProduct(order.id, item.id, product)
                        setEditor(null)
                      }}
                    />
                  </div>
                ) : null}

                {editorOpen && editor.mode === 'MANUAL' ? (
                  <form className="inline-editor form-stack" onSubmit={(event) => submitManualOverride(event, item)} noValidate>
                    <div className="form-grid">
                      <FormField label="Harga review per item" htmlFor={`resolved-manual-price-${item.id}`} error={manualFieldErrors.price}>
                        <input
                          id={`resolved-manual-price-${item.id}`}
                          type="number"
                          min="1"
                          value={manualPrice}
                          onChange={(event) => {
                            setManualPrice(event.target.value)
                            setManualFieldErrors({})
                            setFormError('')
                          }}
                          aria-invalid={Boolean(manualFieldErrors.price)}
                          aria-describedby={manualFieldErrors.price ? `resolved-manual-price-${item.id}-error` : undefined}
                          required
                        />
                      </FormField>
                      <FormField label="Alasan wajib" htmlFor={`resolved-manual-reason-${item.id}`} error={manualFieldErrors.reason}>
                        <input
                          id={`resolved-manual-reason-${item.id}`}
                          value={manualReason}
                          onChange={(event) => {
                            setManualReason(event.target.value)
                            setManualFieldErrors({})
                            setFormError('')
                          }}
                          aria-invalid={Boolean(manualFieldErrors.reason)}
                          aria-describedby={manualFieldErrors.reason ? `resolved-manual-reason-${item.id}-error` : undefined}
                          placeholder="Mengapa hasil review sebelumnya dikoreksi?"
                          required
                        />
                      </FormField>
                    </div>
                    {formError ? <div className="callout callout--danger" role="alert"><strong>Penyesuaian manual belum tersimpan.</strong> {formError}</div> : null}
                    <div><Button size="sm" type="submit">Simpan penyesuaian manual</Button></div>
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
          <div><span>Pratinjau hasil review HET</span><strong>{reviewedPreview === null ? 'Selesaikan pengecualian' : formatCurrency(reviewedPreview)}</strong></div>
          <div className={reviewedPreview !== null && reviewedPreview !== order.arkasBudgetAmount ? 'is-warning' : ''}>
            <span>Selisih</span><strong>{reviewedPreview === null ? '—' : formatCurrency(Math.abs(reviewedPreview - order.arkasBudgetAmount))}</strong>
          </div>
        </div>
        <div className="het-review-footer__confirm">
          <div>
            <strong>Konfirmasi tidak otomatis.</strong>
            <span>Persetujuan membekukan hasil review HET. Nominal final SIPLah / Invoice baru ditetapkan setelah transaksi SIPLah dikonfirmasi.</span>
          </div>
          <Button onClick={confirmReview} disabled={getHetExceptionCount(order) > 0}>Konfirmasi Review HET</Button>
        </div>
        {formError && !editor ? <div className="callout callout--danger" role="alert"><strong>Tindakan HET gagal.</strong> {formError}</div> : null}
      </section>

      <section className="workflow-context-strip">
        <span>Kejadian terakhir</span>
        <strong>{order.timeline[0]?.title}</strong>
        <small>{order.timeline[0] ? formatDateTime(order.timeline[0].occurredAt) : '—'}</small>
      </section>
    </div>
  )
}
