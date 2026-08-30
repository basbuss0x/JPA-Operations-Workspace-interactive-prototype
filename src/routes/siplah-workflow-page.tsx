import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deriveActionCandidates, derivePrimaryNextAction } from '../domain/next-action'
import { isSiplahAdminComplete, isSiplahReadyForVendor } from '../domain/order-state'
import {
  benefitStatusLabels,
  schoolPaymentStatusLabels,
  siplahDocumentKindLabels,
  siplahDocumentStatusLabels,
} from '../domain/presentation'
import type { SiplahDocument } from '../domain/types'
import { usePrototypeStore } from '../store/use-prototype-store'
import { formatCurrency, formatDateTime } from '../utils/format'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { FormField } from '../components/ui/form-field'
import { StatusChip } from '../components/ui/status-chip'

function documentComplete(document: SiplahDocument): boolean {
  return (
    document.available &&
    Boolean(document.fileName) &&
    document.verified &&
    (!document.sendToSchoolRequired || document.sentToSchool)
  )
}

function documentRequirementLabel(document: SiplahDocument): string {
  if (document.requiredForVendorReady) return 'Wajib untuk kesiapan Vendor'
  if (document.requiredForAdminCompletion) return 'Administrasi lanjutan'
  return 'Opsional untuk arsip'
}

interface TransactionFieldErrors {
  amount?: string
  orderNumber?: string
  confirmation?: string
}

export function SiplahWorkflowPage() {
  const { orderId } = useParams()
  const order = usePrototypeStore((state) => orderId ? state.orders[orderId] : undefined)
  const setAccess = usePrototypeStore((state) => state.setSiplahAccess)
  const markOrderPlaced = usePrototypeStore((state) => state.markSiplahOrderPlaced)
  const saveSiplahOrder = usePrototypeStore((state) => state.recordSiplahOrder)
  const markDocumentAvailable = usePrototypeStore((state) => state.markSiplahDocumentAvailable)
  const attachDocument = usePrototypeStore((state) => state.attachSiplahDocument)
  const verifyDocument = usePrototypeStore((state) => state.verifySiplahDocument)
  const sendDocument = usePrototypeStore((state) => state.sendSiplahDocument)
  const [orderNumber, setOrderNumber] = useState('SPL-2026-DEMO-240')
  const [finalAmount, setFinalAmount] = useState(() => order?.hetReviewedAmount === null || order?.hetReviewedAmount === undefined ? '' : String(order.hetReviewedAmount))
  const [amountConfirmed, setAmountConfirmed] = useState(false)
  const [transactionFieldErrors, setTransactionFieldErrors] = useState<TransactionFieldErrors>({})
  const [errorMessage, setErrorMessage] = useState('')
  const [renderedAt] = useState(() => new Date())

  if (!order) {
    return <EmptyState title="Order tidak ditemukan" description="Order SIPLah tidak tersedia pada data demo." action={<Link className="button button--secondary button--md" to="/orders">Kembali ke Pesanan</Link>} />
  }

  const isClosed = order.stage === 'CLOSED'

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setTransactionFieldErrors({})
    const nextErrors: TransactionFieldErrors = {}
    const amount = Number(finalAmount)
    if (!finalAmount.trim()) nextErrors.amount = 'Nominal final transaksi SIPLah wajib diisi.'
    else if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Nominal final transaksi SIPLah harus berupa angka lebih dari nol.'
    if (!orderNumber.trim()) nextErrors.orderNumber = 'Nomor order SIPLah wajib diisi.'
    if (!amountConfirmed) nextErrors.confirmation = 'Konfirmasi nominal transaksi wajib dicentang.'
    if (nextErrors.amount || nextErrors.orderNumber || nextErrors.confirmation) {
      setTransactionFieldErrors(nextErrors)
      document.getElementById(nextErrors.amount ? 'siplah-final-amount' : nextErrors.orderNumber ? 'siplah-order-number' : 'siplah-amount-confirmation')?.focus()
      return
    }
    try {
      saveSiplahOrder(order.id, {
        orderNumber: orderNumber.trim(),
        finalInvoiceAmount: amount,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transaksi SIPLah gagal dicatat.')
    }
  }

  const attachRequiredDemoPackage = () => {
    try {
      for (const document of order.siplah.documents.filter((candidate) => candidate.requiredForAdminCompletion)) {
        attachDocument(order.id, document.kind, `${document.kind}-${order.id}.pdf`)
      }
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Paket dokumen administrasi gagal dilampirkan.')
    }
  }

  const readyForVendor = isSiplahReadyForVendor(order)
  const adminComplete = isSiplahAdminComplete(order)
  const primaryAction = derivePrimaryNextAction(
    deriveActionCandidates(order, { vendorBatch: null }, renderedAt),
  )
  const vendorDocuments = order.siplah.documents.filter((document) => document.requiredForVendorReady)
  const adminDocuments = order.siplah.documents.filter((document) => document.requiredForAdminCompletion)
  const completedVendorDocuments = vendorDocuments.filter(documentComplete).length
  const completedAdminDocuments = adminDocuments.filter(documentComplete).length
  const reviewedAmount = order.hetReviewedAmount
  const finalDifference = order.finalInvoiceAmount === null || reviewedAmount === null
    ? null
    : order.finalInvoiceAmount - reviewedAmount

  return (
    <div className="page-stack focused-route siplah-workflow-page">
      <Link className="back-link" to={`/orders/${order.id}`}>← Ruang kerja order</Link>
      <header className="focused-route__header">
        <div>
          <p className="eyebrow">Operasional SIPLah</p>
          <h1>Alur SIPLah</h1>
          <p>{order.schoolName} · {order.id}</p>
        </div>
        <StatusChip tone={isClosed ? 'success' : readyForVendor ? 'success' : 'warning'}>
          {isClosed ? 'Order selesai · hanya baca' : readyForVendor ? 'Siap masuk Vendor Batch' : 'Syarat belum lengkap'}
        </StatusChip>
      </header>

      {isClosed ? (
        <div className="callout callout--info">
          <strong>Order sudah selesai.</strong> Syarat SIPLah ditampilkan sebagai konteks hanya baca. Gunakan “Buka kembali order” dari ruang kerja bila koreksi disetujui.
        </div>
      ) : null}

      {order.het.status !== 'APPROVED' ? (
        <section className="callout callout--danger">
          <strong>HET belum disetujui.</strong> Selesaikan review dan konfirmasi HET sebelum menjalankan SIPLah.
          <div><Link className="button button--secondary button--sm" to={`/orders/${order.id}/arkas`}>Buka Review HET</Link></div>
        </section>
      ) : null}

      <ol className="workflow-steps" aria-label="Tahapan SIPLah">
        <li className={order.siplah.accessAvailable ? 'is-active' : ''}><span>1</span>Akses</li>
        <li className={order.siplah.orderPlaced && order.siplah.orderNumber && order.finalInvoiceAmount !== null ? 'is-active' : ''}><span>2</span>Order & nominal</li>
        <li className={adminComplete ? 'is-active' : ''}><span>3</span>Administrasi</li>
        <li className={readyForVendor ? 'is-active' : ''}><span>4</span>Siap Vendor</li>
      </ol>

      <section className="workspace-panel siplah-checkpoint-card">
        <div className="checkpoint-number">1</div>
        <div className="checkpoint-content">
          <div className="panel-heading">
            <div><h2>Akses SIPLah tersedia</h2><p>Hanya status akses yang dicatat. Nama pengguna dan kata sandi asli tidak pernah diminta atau disimpan.</p></div>
            <StatusChip tone={order.siplah.accessAvailable ? 'success' : 'warning'}>{order.siplah.accessAvailable ? 'Tersedia' : 'Belum tersedia'}</StatusChip>
          </div>
          <Button
            variant={order.siplah.accessAvailable ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setAccess(order.id, !order.siplah.accessAvailable)}
            disabled={isClosed || order.het.status !== 'APPROVED'}
          >
            {order.siplah.accessAvailable ? 'Tandai belum tersedia' : 'Tandai akses tersedia'}
          </Button>
        </div>
      </section>

      <section className="workspace-panel siplah-checkpoint-card">
        <div className="checkpoint-number">2</div>
        <div className="checkpoint-content">
          <div className="panel-heading">
            <div><h2>Pesanan dibuat di JPA/TokoLadang</h2><p>Nominal transaksi final harus dikonfirmasi dari transaksi SIPLah; ARKAS dan hasil review HET tidak berubah.</p></div>
            <StatusChip tone={order.siplah.orderPlaced ? 'success' : 'neutral'}>{order.siplah.orderPlaced ? 'Sudah dibuat' : 'Belum dibuat'}</StatusChip>
          </div>
          {!order.siplah.orderPlaced ? (
            <Button onClick={() => markOrderPlaced(order.id)} disabled={isClosed || !order.siplah.accessAvailable || order.het.status !== 'APPROVED'}>
              Tandai pesanan dibuat
            </Button>
          ) : order.siplah.orderNumber ? (
            <div className="recorded-value"><span>Nomor order SIPLah · nominal final</span><strong>{order.siplah.orderNumber} · {order.finalInvoiceAmount === null ? 'Belum ditetapkan' : formatCurrency(order.finalInvoiceAmount)}</strong></div>
          ) : (
            <form className="inline-action-form siplah-transaction-form" onSubmit={submitOrder} noValidate>
              <div className="totals-strip totals-strip--four">
                <div><span>Sumber ARKAS</span><strong>{formatCurrency(order.arkasBudgetAmount)}</strong></div>
                <div><span>Hasil review HET</span><strong>{reviewedAmount === null ? 'Belum ada' : formatCurrency(reviewedAmount)}</strong></div>
                <div><span>Nominal final SIPLah / Invoice</span><strong>Menunggu konfirmasi</strong></div>
                <div><span>Selisih</span><strong>—</strong></div>
              </div>
              <div className="form-grid">
                <FormField label="Nominal final transaksi SIPLah" htmlFor="siplah-final-amount" hint="Terisi dari hasil review HET; ubah jika nominal transaksi aktual berbeda." error={transactionFieldErrors.amount}>
                  <input
                    id="siplah-final-amount"
                    type="number"
                    min="1"
                    value={finalAmount}
                    readOnly={isClosed}
                    onChange={(event) => {
                      setFinalAmount(event.target.value)
                      setAmountConfirmed(false)
                      setTransactionFieldErrors({})
                      setErrorMessage('')
                    }}
                    aria-invalid={Boolean(transactionFieldErrors.amount)}
                    aria-describedby={transactionFieldErrors.amount ? 'siplah-final-amount-error' : undefined}
                    required
                  />
                </FormField>
                <FormField label="Nomor order SIPLah" htmlFor="siplah-order-number" error={transactionFieldErrors.orderNumber}>
                  <input
                    id="siplah-order-number"
                    value={orderNumber}
                    onChange={(event) => {
                      setOrderNumber(event.target.value)
                      setTransactionFieldErrors({})
                      setErrorMessage('')
                    }}
                    aria-invalid={Boolean(transactionFieldErrors.orderNumber)}
                    aria-describedby={transactionFieldErrors.orderNumber ? 'siplah-order-number-error' : undefined}
                    placeholder="SPL-2026-…"
                    readOnly={isClosed}
                    required
                  />
                </FormField>
              </div>
              <div className="confirmation-checkbox-field">
                <label className="confirmation-checkbox" htmlFor="siplah-amount-confirmation">
                  <input
                    id="siplah-amount-confirmation"
                    type="checkbox"
                    checked={amountConfirmed}
                    onChange={(event) => {
                      setAmountConfirmed(event.target.checked)
                      setTransactionFieldErrors({})
                      setErrorMessage('')
                    }}
                    aria-invalid={Boolean(transactionFieldErrors.confirmation)}
                    aria-describedby={transactionFieldErrors.confirmation ? 'siplah-amount-confirmation-error' : undefined}
                    disabled={isClosed}
                    required
                  />
                  <span>Saya mengonfirmasi nominal final sesuai transaksi SIPLah aktual.</span>
                </label>
                {transactionFieldErrors.confirmation ? <span id="siplah-amount-confirmation-error" className="form-error" role="alert">{transactionFieldErrors.confirmation}</span> : null}
              </div>
              <Button type="submit" disabled={isClosed || !amountConfirmed}>Konfirmasi nominal & catat order</Button>
            </form>
          )}
        </div>
      </section>

      <section className="workspace-panel workspace-panel--wide transaction-summary-panel">
        <div className="panel-heading">
          <div><h2>Jejak nominal transaksi</h2><p>Empat angka ini tetap berbeda sumber dan tidak saling menimpa.</p></div>
          <StatusChip tone={order.finalInvoiceAmount === null ? 'warning' : 'success'}>{order.finalInvoiceAmount === null ? 'Final belum dikonfirmasi' : 'Final dikonfirmasi'}</StatusChip>
        </div>
        <div className="totals-strip totals-strip--four">
          <div><span>Sumber ARKAS</span><strong>{formatCurrency(order.arkasBudgetAmount)}</strong></div>
          <div><span>Hasil review HET</span><strong>{reviewedAmount === null ? '—' : formatCurrency(reviewedAmount)}</strong></div>
          <div><span>Nominal final SIPLah / Invoice</span><strong>{order.finalInvoiceAmount === null ? '—' : formatCurrency(order.finalInvoiceAmount)}</strong></div>
          <div className={finalDifference !== null && finalDifference !== 0 ? 'is-warning' : ''}><span>Selisih vs HET</span><strong>{finalDifference === null ? '—' : finalDifference === 0 ? formatCurrency(0) : `${finalDifference > 0 ? '+' : ''}${formatCurrency(finalDifference)}`}</strong></div>
        </div>
      </section>

      <section className="workspace-panel siplah-documents-section">
        <div className="panel-heading">
          <div>
            <span className="checkpoint-kicker">SYARAT 3</span>
            <h2>Dokumen SIPLah</h2>
            <p>{completedVendorDocuments} dari {vendorDocuments.length} dokumen untuk Vendor lengkap · {completedAdminDocuments} dari {adminDocuments.length} dokumen administrasi lengkap. Invoice, Kwitansi, dan BAST dapat dilengkapi setelah order masuk Vendor.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={attachRequiredDemoPackage} disabled={isClosed || !order.siplah.orderPlaced}>
            Lampirkan paket administrasi demo
          </Button>
        </div>

        <div className="siplah-document-list">
          {order.siplah.documents.map((document) => {
            const completeDocument = documentComplete(document)
            return (
              <article className="siplah-document-row" key={document.kind}>
                <div className="siplah-document-row__identity">
                  <span className={completeDocument ? 'document-icon is-complete' : 'document-icon'}>{completeDocument ? '✓' : '▤'}</span>
                  <div><strong>{document.label}</strong><small>{siplahDocumentKindLabels[document.kind]} · {documentRequirementLabel(document)}</small></div>
                </div>
                <div className="document-statuses">
                  <StatusChip tone={document.available ? 'success' : 'neutral'}>{document.available ? siplahDocumentStatusLabels.available : siplahDocumentStatusLabels.unavailable}</StatusChip>
                  <StatusChip tone={document.fileName ? 'success' : 'neutral'}>{document.fileName ? siplahDocumentStatusLabels.attached : siplahDocumentStatusLabels.unattached}</StatusChip>
                  <StatusChip tone={document.verified ? 'success' : 'warning'}>{document.verified ? siplahDocumentStatusLabels.verified : siplahDocumentStatusLabels.unverified}</StatusChip>
                  {document.sendToSchoolRequired ? (
                    <StatusChip tone={document.sentToSchool ? 'success' : 'warning'}>{document.sentToSchool ? siplahDocumentStatusLabels.sent : siplahDocumentStatusLabels.unsent}</StatusChip>
                  ) : <StatusChip>{siplahDocumentStatusLabels.notSentRequired}</StatusChip>}
                </div>
                {document.fileName ? <span className="document-file-name">{document.fileName}</span> : null}
                <div className="siplah-document-row__actions">
                  {!document.available ? (
                    <Button size="sm" variant="secondary" onClick={() => markDocumentAvailable(order.id, document.kind)} disabled={isClosed || !order.siplah.orderPlaced}>Tandai tersedia</Button>
                  ) : null}
                  {!document.fileName ? (
                    <Button size="sm" variant="secondary" onClick={() => attachDocument(order.id, document.kind, `${document.kind}-${order.id}.pdf`)} disabled={isClosed || !order.siplah.orderPlaced}>Lampirkan demo</Button>
                  ) : null}
                  {document.fileName && !document.verified ? (
                    <Button size="sm" onClick={() => verifyDocument(order.id, document.kind)} disabled={isClosed}>Verifikasi</Button>
                  ) : null}
                  {document.sendToSchoolRequired && document.verified && !document.sentToSchool ? (
                    <Button size="sm" onClick={() => sendDocument(order.id, document.kind)} disabled={isClosed}>Tandai dikirim</Button>
                  ) : null}
                  {completeDocument ? <span className="document-done">Selesai</span> : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {readyForVendor && !adminComplete ? (
        <section className="callout callout--info">
          <strong>Siap masuk Vendor Batch.</strong> Surat Pesanan sudah memenuhi syarat pembelian. Invoice, Kwitansi, dan BAST masih terlihat belum lengkap sebagai administrasi SIPLah lanjutan dan tidak memblokir Vendor Batch.
        </section>
      ) : null}
      {errorMessage ? <div className="callout callout--danger" role="alert"><strong>Perubahan SIPLah belum tersimpan.</strong> {errorMessage}</div> : null}

      <section className={readyForVendor ? 'siplah-completion is-complete' : 'siplah-completion'}>
        <div>
          <span>{readyForVendor ? '✓' : '○'}</span>
          <div>
            <h2>{readyForVendor ? 'Siap masuk Vendor Batch' : 'SIPLah belum siap untuk Vendor Batch'}</h2>
            <p>{readyForVendor
              ? adminComplete
                ? 'Syarat pembelian dan administrasi SIPLah sudah lengkap.'
                : 'Syarat pembelian sudah lengkap. Administrasi SIPLah adalah status terpisah yang dapat menyusul.'
              : 'Lengkapi akses, transaksi, nomor order, dan Surat Pesanan tanpa melompati verifikasi.'}</p>
          </div>
        </div>
        {readyForVendor ? (
          <Link className="button button--primary button--md" to="/vendor-batches">
            {primaryAction?.kind === 'ADD_TO_VENDOR_BATCH' ? primaryAction.title : 'Lihat area Vendor'}
          </Link>
        ) : null}
      </section>

      <section className="workspace-panel siplah-admin-status-panel">
        <div className="panel-heading">
          <div><h2>Administrasi SIPLah</h2><p>Dihitung otomatis dari order, nomor transaksi, dan dokumen yang ditetapkan untuk penyelesaian; bukan kotak centang manual.</p></div>
          <StatusChip tone={adminComplete ? 'success' : 'warning'}>{adminComplete ? 'Administrasi SIPLah lengkap' : 'Administrasi SIPLah belum lengkap'}</StatusChip>
        </div>
        <p>{adminComplete
          ? 'Dokumen administrasi yang ditetapkan sudah tersedia, terlampir, terverifikasi, dan dikirim bila memang diwajibkan.'
          : 'Invoice, Kwitansi, dan BAST tetap menjadi pekerjaan administrasi lanjutan. Ketidaklengkapan ini tidak membatalkan kesiapan Vendor Batch.'}</p>
      </section>

      <section className="independence-strip">
        <div><span>Pembayaran sekolah</span><StatusChip tone={order.schoolPayment.status === 'LUNAS' ? 'success' : 'neutral'}>{schoolPaymentStatusLabels[order.schoolPayment.status]}</StatusChip></div>
        <div><span>Benefit</span><StatusChip tone={order.benefit.status === 'ELIGIBLE' ? 'warning' : order.benefit.status === 'PAID' ? 'success' : 'neutral'}>{benefitStatusLabels[order.benefit.status]}</StatusChip></div>
        <p>Kesiapan SIPLah dan administrasinya tidak mengubah dua status keuangan ini.</p>
      </section>

      <section className="workflow-context-strip">
        <span>Kejadian terakhir</span><strong>{order.timeline[0]?.title}</strong><small>{order.timeline[0] ? formatDateTime(order.timeline[0].occurredAt) : '—'}</small>
      </section>
    </div>
  )
}
