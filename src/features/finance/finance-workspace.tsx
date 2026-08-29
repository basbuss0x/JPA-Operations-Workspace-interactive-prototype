import { useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { calculateBenefitAmount, isCompletionReady } from '../../domain/selectors'
import type { BenefitPaymentMethod, BenefitRecipientType, Order } from '../../domain/types'
import { ClosureChecklist } from '../../components/orders/closure-checklist'
import { usePrototypeStore } from '../../store/use-prototype-store'
import { formatCurrency, formatDate } from '../../utils/format'
import {
  calendarDateToReminderTimestamp,
  futureCalendarDate,
  reminderTimestampToCalendarDate,
  validateReminderCalendarDate,
} from '../../utils/reminder-date'
import { Button } from '../../components/ui/button'
import { FormField } from '../../components/ui/form-field'
import { Modal } from '../../components/ui/modal'
import { StatusChip } from '../../components/ui/status-chip'

function FinanceRow({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="detail-row">
      <div><span className="detail-row__label">{label}</span>{detail ? <small>{detail}</small> : null}</div>
      <div className="detail-row__value">{value}</div>
    </div>
  )
}

export function FinanceWorkspace({ order }: { order: Order }) {
  const confirmSchoolPayment = usePrototypeStore((state) => state.confirmSchoolPayment)
  const setPaymentFollowUp = usePrototypeStore((state) => state.setPaymentFollowUp)
  const paySchoolBenefit = usePrototypeStore((state) => state.paySchoolBenefit)
  const confirmBenefitReceipt = usePrototypeStore((state) => state.confirmBenefitReceipt)
  const closeSchoolOrder = usePrototypeStore((state) => state.closeSchoolOrder)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [benefitOpen, setBenefitOpen] = useState(false)
  const [grossAmount, setGrossAmount] = useState(String(order.finalInvoiceAmount ?? ''))
  const [deductionAmount, setDeductionAmount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('SIPLah settlement')
  const [paymentEvidence, setPaymentEvidence] = useState(`Bukti-${order.id}.pdf`)
  const [followUpDate, setFollowUpDate] = useState(() =>
    reminderTimestampToCalendarDate(order.schoolPayment.followUpDueAt) || futureCalendarDate(3),
  )
  const [reminderError, setReminderError] = useState<string | null>(null)
  const [benefitMethod, setBenefitMethod] = useState<BenefitPaymentMethod>('TRANSFER')
  const [recipientType, setRecipientType] = useState<BenefitRecipientType>('SCHOOL_OFFICIAL')
  const [recipient, setRecipient] = useState('Bendahara sekolah')
  const [accountReference, setAccountReference] = useState('Rekening/transfer demo')
  const [benefitProof, setBenefitProof] = useState(`Benefit-${order.id}.pdf`)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const closeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [closeConfirmed, setCloseConfirmed] = useState(false)
  const [closeSubmitting, setCloseSubmitting] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const benefitAmount = calculateBenefitAmount(order)
  const closeReady = isCompletionReady(order)
  const derivedNet = Number(grossAmount || 0) - Number(deductionAmount || 0)

  const run = (action: () => void, message: string) => {
    setError(null)
    setFeedback(null)
    try {
      action()
      setFeedback(message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tindakan pembayaran gagal.')
    }
  }

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      confirmSchoolPayment(order.id, {
        schoolPaidAmount: Number(grossAmount),
        deductionAmount: Number(deductionAmount),
        netReceivedAmount: derivedNet,
        method: paymentMethod,
        evidenceName: paymentEvidence,
      })
      setPaymentOpen(false)
      setError(null)
      setFeedback('Pembayaran LUNAS dicatat. Benefit 10% kini eligible dari invoice gross.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pembayaran gagal dicatat.')
    }
  }

  const submitBenefit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (benefitAmount === null) return
    try {
      paySchoolBenefit(order.id, {
        amount: benefitAmount,
        method: benefitMethod,
        recipientType,
        recipient,
        accountReference,
        proofName: benefitProof,
      })
      setBenefitOpen(false)
      setError(null)
      setFeedback('Benefit dibayar satu kali penuh.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Benefit gagal dicatat.')
    }
  }

  const saveReminder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateReminderCalendarDate(followUpDate)
    if (validationError) {
      setReminderError(validationError)
      setError(null)
      setFeedback(null)
      return
    }

    const dueAt = calendarDateToReminderTimestamp(followUpDate)
    setReminderError(null)
    run(
      () => setPaymentFollowUp(order.id, dueAt),
      'Reminder pembayaran disimpan.',
    )
  }

  const openCloseReview = (event: MouseEvent<HTMLButtonElement>) => {
    closeTriggerRef.current = event.currentTarget
    setCloseConfirmed(false)
    setCloseError(null)
    setCloseOpen(true)
  }

  const closeReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!closeConfirmed || closeSubmitting) return
    setCloseSubmitting(true)
    setCloseError(null)
    try {
      closeSchoolOrder(order.id)
      setCloseOpen(false)
      setCloseConfirmed(false)
      setCloseSubmitting(false)
      setFeedback('Order ditutup setelah review checkpoint.')
    } catch (caught) {
      setCloseError(caught instanceof Error ? caught.message : 'Order gagal ditutup.')
      setCloseSubmitting(false)
    }
  }

  const cancelCloseReview = () => {
    if (closeSubmitting) return
    setCloseOpen(false)
    setCloseConfirmed(false)
    setCloseError(null)
  }

  return (
    <div className="finance-workspace">
      {feedback ? <div className="callout callout--success" role="status">{feedback}</div> : null}
      {error && !paymentOpen && !benefitOpen ? <div className="callout callout--danger" role="alert"><strong>Tindakan gagal.</strong> {error}</div> : null}

      <div className="workspace-grid">
        <section className="workspace-panel payment-operations-panel">
          <div className="panel-heading">
            <div><h2>Pembayaran sekolah</h2><p>Konfirmasi settlement gross; bukan ledger accounting.</p></div>
            <StatusChip tone={order.schoolPayment.status === 'LUNAS' ? 'success' : 'warning'}>{order.schoolPayment.status}</StatusChip>
          </div>
          <div className="detail-list">
            <FinanceRow label="Invoice final gross" value={order.finalInvoiceAmount === null ? 'Belum ditetapkan' : formatCurrency(order.finalInvoiceAmount)} />
            <FinanceRow label="Gross dibayar sekolah" value={formatCurrency(order.schoolPayment.schoolPaidAmount)} />
            <FinanceRow label="Potongan settlement" detail="Platform, pajak, atau potongan lain pada settlement ini" value={formatCurrency(order.schoolPayment.deductionAmount)} />
            <FinanceRow label="Net diterima JPA" value={formatCurrency(order.schoolPayment.netReceivedAmount)} />
            <FinanceRow label="Tanggal" value={formatDate(order.schoolPayment.paidAt)} />
            <FinanceRow label="Metode" value={order.schoolPayment.method ?? '—'} />
            <FinanceRow label="Bukti" value={order.schoolPayment.evidenceName ?? 'Belum ada'} />
          </div>
          {order.stage !== 'CLOSED' && order.schoolPayment.status === 'UNPAID' && order.finalInvoiceAmount !== null ? (
            <Button onClick={() => { setError(null); setPaymentOpen(true) }}>Confirm LUNAS</Button>
          ) : null}
        </section>

        <section className="workspace-panel benefit-operations-panel">
          <div className="panel-heading">
            <div><h2>Benefit sekolah</h2><p>Tepat 10% dari invoice final gross—bukan net settlement.</p></div>
            <StatusChip tone={order.benefit.status === 'PAID' ? 'success' : order.benefit.status === 'ELIGIBLE' ? 'warning' : 'neutral'}>{order.benefit.status.replaceAll('_', ' ')}</StatusChip>
          </div>
          <div className="benefit-amount">
            <span>Obligation {order.benefit.obligationAmount === null ? 'belum dibekukan' : 'dibekukan saat LUNAS'}</span>
            <strong>{benefitAmount === null ? '—' : formatCurrency(benefitAmount)}</strong>
          </div>
          <div className="detail-list">
            <FinanceRow label="Basis gross" value={order.benefit.baseAmount === null ? '—' : formatCurrency(order.benefit.baseAmount)} />
            <FinanceRow label="Dibayar" value={formatDate(order.benefit.paidAt)} />
            <FinanceRow label="Metode" value={order.benefit.method ?? '—'} />
            <FinanceRow label="Tipe penerima" value={order.benefit.recipientType?.replaceAll('_', ' ') ?? '—'} />
            <FinanceRow label="Nama penerima" value={order.benefit.recipient ?? '—'} />
            <FinanceRow label="Referensi" value={order.benefit.accountReference ?? '—'} />
            <FinanceRow label="Konfirmasi sekolah" detail="Opsional; tidak memblokir closure" value={formatDate(order.benefit.schoolConfirmedAt)} />
          </div>
          {order.stage !== 'CLOSED' && order.benefit.status === 'ELIGIBLE' ? <Button onClick={() => { setError(null); setBenefitOpen(true) }}>Bayar benefit penuh</Button> : null}
          {order.benefit.status === 'PAID' && !order.benefit.schoolConfirmedAt && order.stage !== 'CLOSED' ? (
            <Button variant="secondary" onClick={() => run(() => confirmBenefitReceipt(order.id), 'Konfirmasi penerimaan benefit oleh sekolah dicatat.')}>Catat konfirmasi sekolah</Button>
          ) : null}
        </section>

        <section className="workspace-panel workspace-panel--wide supplier-summary">
          <div><span>Kewajiban supplier</span><strong>{order.supplierPayment.obligationAmount === null ? 'Belum ditetapkan' : formatCurrency(order.supplierPayment.obligationAmount)}</strong></div>
          <div><span>Sudah dibayar</span><strong>{formatCurrency(order.supplierPayment.paidAmount)}</strong></div>
          <div><span>Status</span><StatusChip tone={order.supplierPayment.status === 'PAID' ? 'success' : 'neutral'}>{order.supplierPayment.status}</StatusChip></div>
          <p>Biaya supplier tidak diturunkan dari ARKAS atau persentase. Outstanding supplier tidak memblokir closure order sekolah.</p>
        </section>
      </div>

      {order.schoolPayment.status === 'UNPAID' && order.stage !== 'CLOSED' ? (
        <section className="workspace-panel payment-reminder-panel">
          <div>
            <h2>Reminder pembayaran</h2>
            <p>UNPAID tetap pasif sampai tanggal follow-up eksplisit tercapai.</p>
          </div>
          {!reminderTimestampToCalendarDate(order.schoolPayment.followUpDueAt) ? (
            <div className="callout callout--warning reminder-setup-callout">
              <strong>Atur tindak lanjut pembayaran.</strong> Tanggal belum dikonfirmasi; kolom sudah diisi saran tiga hari dari hari ini. Simpan untuk mengaktifkan jadwal.
            </div>
          ) : (
            <div className="callout callout--success reminder-setup-callout">
              <strong>Reminder pembayaran tersimpan.</strong> Follow-up dijadwalkan pada {formatDate(order.schoolPayment.followUpDueAt)}.
            </div>
          )}
          <form className="inline-action-form" onSubmit={saveReminder}>
            <FormField
              label="Tanggal follow-up"
              htmlFor={`payment-follow-up-${order.id}`}
              hint="Tanggal hari ini atau sesudahnya; tetap klik Simpan reminder untuk konfirmasi."
            >
              <input
                id={`payment-follow-up-${order.id}`}
                type="date"
                value={followUpDate}
                aria-invalid={Boolean(reminderError)}
                aria-describedby={reminderError ? `payment-follow-up-error-${order.id}` : undefined}
                onChange={(event) => {
                  setFollowUpDate(event.target.value)
                  setReminderError(null)
                  setError(null)
                }}
              />
              {reminderError ? <span id={`payment-follow-up-error-${order.id}`} className="form-error" role="alert">{reminderError}</span> : null}
            </FormField>
            <div className="reminder-form-actions">
              <Button variant="secondary" type="submit">Simpan reminder</Button>
              {order.schoolPayment.followUpDueAt ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(event) => {
                    if (event.detail > 1) return
                    setFollowUpDate('')
                    setReminderError(null)
                    run(() => setPaymentFollowUp(order.id, null), 'Reminder pembayaran dihapus.')
                  }}
                >
                  Clear reminder
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {order.stage !== 'CLOSED' ? (
        <section className={closeReady ? 'workspace-panel closure-panel' : 'workspace-panel closure-panel closure-panel--blocked'}>
          <div>
            <h2>{closeReady ? 'Siap ditutup' : 'Penutupan order belum siap'}</h2>
            <p>{closeReady ? 'Review semua checkpoint sebelum mengubah order menjadi CLOSED. Supplier tidak menjadi blocker.' : 'Checkpoint yang belum selesai ditampilkan agar penutupan tidak dilakukan sebelum waktunya.'}</p>
          </div>
          <ClosureChecklist order={order} />
          {closeReady ? (
            <Button onClick={openCloseReview}>Review penutupan</Button>
          ) : (
            <div className="inline-clear-state inline-clear-state--neutral">Belum dapat ditutup. Lengkapi checkpoint wajib yang bertanda ○.</div>
          )}
        </section>
      ) : (
        <section className="workspace-panel closure-panel closure-panel--readonly">
          <div>
            <h2>Order selesai</h2>
            <p>Order sudah CLOSED dan workspace ini read-only. Riwayat tetap tersedia di Timeline.</p>
          </div>
          <ClosureChecklist order={order} />
          <div className="readonly-workflow-note">Jika perlu koreksi operasional, gunakan aksi “Buka kembali order” di atas sebelum mengubah checkpoint.</div>
        </section>
      )}

      <Modal
        open={closeOpen}
        title="Review penutupan order"
        description="Pastikan semua checkpoint blocking selesai sebelum order diubah menjadi CLOSED."
        onClose={cancelCloseReview}
        restoreFocusRef={closeTriggerRef}
        footer={
          <>
            <Button variant="ghost" onClick={cancelCloseReview}>Batal</Button>
            <Button
              type="submit"
              form="close-review-form"
              disabled={!closeConfirmed || closeSubmitting}
            >
              {closeSubmitting ? 'Menutup…' : 'Konfirmasi tutup order'}
            </Button>
          </>
        }
      >
        <form id="close-review-form" className="form-stack" onSubmit={closeReview}>
          <ClosureChecklist order={order} />
          <label className="checkbox-field">
            <input
              type="checkbox"
              autoFocus
              data-autofocus="true"
              checked={closeConfirmed}
              onChange={(event) => setCloseConfirmed(event.target.checked)}
            />
            <span>Saya sudah meninjau checkpoint dan mengonfirmasi penutupan order ini.</span>
          </label>
          {closeError ? <div className="callout callout--danger" role="alert"><strong>Order belum ditutup.</strong> {closeError}</div> : null}
        </form>
      </Modal>

      <Modal
        open={paymentOpen}
        title="Confirm pembayaran LUNAS"
        description="Gross harus sama dengan invoice final. Potongan hanya mengurangi net diterima, bukan benefit basis."
        onClose={() => setPaymentOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setPaymentOpen(false)}>Batal</Button><Button type="submit" form="school-payment-form">Confirm LUNAS</Button></>}
      >
        <form id="school-payment-form" className="form-stack" onSubmit={submitPayment}>
          {error ? <div className="callout callout--danger" role="alert"><strong>Pembayaran belum tersimpan.</strong> {error}</div> : null}
          <FormField label="Gross dibayar sekolah" htmlFor="school-paid-gross">
            <input id="school-paid-gross" type="number" min="0" value={grossAmount} onChange={(event) => setGrossAmount(event.target.value)} required />
          </FormField>
          <FormField label="Potongan settlement" htmlFor="school-payment-deduction" hint="Isi 0 untuk transfer langsung tanpa potongan.">
            <input id="school-payment-deduction" type="number" min="0" value={deductionAmount} onChange={(event) => setDeductionAmount(event.target.value)} required />
          </FormField>
          <div className="derived-settlement"><span>Net diterima JPA</span><strong>{formatCurrency(derivedNet)}</strong><small>Gross − potongan</small></div>
          <FormField label="Metode" htmlFor="school-payment-method"><select id="school-payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Transfer bank</option><option>SIPLah settlement</option><option>Cash</option></select></FormField>
          <FormField label="Bukti pembayaran" htmlFor="school-payment-proof"><input id="school-payment-proof" value={paymentEvidence} onChange={(event) => setPaymentEvidence(event.target.value)} required /></FormField>
        </form>
      </Modal>

      <Modal
        open={benefitOpen}
        title="Bayar benefit penuh"
        description={`Nominal wajib tepat ${benefitAmount === null ? '—' : formatCurrency(benefitAmount)} dan tidak dapat dicicil.`}
        onClose={() => setBenefitOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setBenefitOpen(false)}>Batal</Button><Button type="submit" form="benefit-payment-form">Catat benefit PAID</Button></>}
      >
        <form id="benefit-payment-form" className="form-stack" onSubmit={submitBenefit}>
          {error ? <div className="callout callout--danger" role="alert"><strong>Benefit belum tersimpan.</strong> {error}</div> : null}
          <div className="derived-settlement"><span>Benefit obligation</span><strong>{benefitAmount === null ? '—' : formatCurrency(benefitAmount)}</strong><small>10% invoice final gross</small></div>
          <FormField label="Metode" htmlFor="benefit-method"><select id="benefit-method" value={benefitMethod} onChange={(event) => {
            const method = event.target.value as BenefitPaymentMethod
            setBenefitMethod(method)
            if (method === 'CASH') setAccountReference('')
          }}><option value="TRANSFER">TRANSFER</option><option value="CASH">CASH</option></select></FormField>
          <FormField label="Tipe penerima" htmlFor="benefit-recipient-type"><select id="benefit-recipient-type" value={recipientType} onChange={(event) => setRecipientType(event.target.value as BenefitRecipientType)}><option value="SCHOOL_OFFICIAL">SCHOOL_OFFICIAL</option><option value="INDIVIDUAL">INDIVIDUAL</option></select></FormField>
          <FormField label="Nama penerima" htmlFor="benefit-recipient"><input id="benefit-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} required /></FormField>
          {benefitMethod === 'TRANSFER' ? <FormField label="Rekening / referensi transfer" htmlFor="benefit-account-reference"><input id="benefit-account-reference" value={accountReference} onChange={(event) => setAccountReference(event.target.value)} required /></FormField> : null}
          <FormField label="Bukti benefit" htmlFor="benefit-proof"><input id="benefit-proof" value={benefitProof} onChange={(event) => setBenefitProof(event.target.value)} required /></FormField>
        </form>
      </Modal>
    </div>
  )
}
