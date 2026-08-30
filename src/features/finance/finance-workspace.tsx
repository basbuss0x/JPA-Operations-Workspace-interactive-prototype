import { useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { calculateBenefitAmount, isCompletionReady } from '../../domain/selectors'
import type { BenefitPaymentMethod, BenefitRecipientType, Order } from '../../domain/types'
import {
  benefitPaymentMethodLabels,
  benefitRecipientTypeLabels,
  benefitStatusLabels,
  schoolPaymentMethodLabels,
  schoolPaymentStatusLabels,
  supplierPaymentStatusLabels,
} from '../../domain/presentation'
import { ClosureChecklist } from '../../components/orders/closure-checklist'
import { usePrototypeStore } from '../../store/use-prototype-store'
import { formatCurrency, formatDate } from '../../utils/format'
import { ReminderForm } from '../../components/work-queue/reminder-form'
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

interface PaymentFieldErrors {
  gross?: string
  deduction?: string
  evidence?: string
}

interface BenefitFieldErrors {
  recipient?: string
  accountReference?: string
  proof?: string
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
  const [benefitMethod, setBenefitMethod] = useState<BenefitPaymentMethod>('TRANSFER')
  const [recipientType, setRecipientType] = useState<BenefitRecipientType>('SCHOOL_OFFICIAL')
  const [recipient, setRecipient] = useState('Bendahara sekolah')
  const [accountReference, setAccountReference] = useState('Rekening/transfer demo')
  const [benefitProof, setBenefitProof] = useState(`Benefit-${order.id}.pdf`)
  const [error, setError] = useState<string | null>(null)
  const [paymentFieldErrors, setPaymentFieldErrors] = useState<PaymentFieldErrors>({})
  const [benefitFieldErrors, setBenefitFieldErrors] = useState<BenefitFieldErrors>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const closeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [closeConfirmed, setCloseConfirmed] = useState(false)
  const [closeSubmitting, setCloseSubmitting] = useState(false)
  const [closeConfirmationError, setCloseConfirmationError] = useState<string | null>(null)
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

  const validatePayment = (): boolean => {
    const nextErrors: PaymentFieldErrors = {}
    const gross = Number(grossAmount)
    const deduction = Number(deductionAmount)
    const grossValid = grossAmount.trim() !== '' && Number.isFinite(gross) && gross > 0
    const deductionValid = deductionAmount.trim() !== '' && Number.isFinite(deduction) && deduction >= 0

    if (!grossAmount.trim()) nextErrors.gross = 'Nominal gross wajib diisi.'
    else if (!grossValid) nextErrors.gross = 'Nominal gross harus berupa angka lebih dari nol.'
    if (!deductionAmount.trim()) nextErrors.deduction = 'Potongan settlement wajib diisi; isi 0 jika tidak ada potongan.'
    else if (!deductionValid) nextErrors.deduction = 'Potongan settlement harus berupa angka nol atau lebih.'
    if (grossValid && deductionValid && deduction > gross) {
      nextErrors.deduction = 'Potongan settlement tidak boleh melebihi pembayaran gross.'
    }
    if (grossValid && order.finalInvoiceAmount !== null && gross !== order.finalInvoiceAmount) {
      nextErrors.gross = `gross harus sama dengan invoice final ${formatCurrency(order.finalInvoiceAmount)}.`
    }
    if (!paymentEvidence.trim()) nextErrors.evidence = 'Bukti pembayaran wajib diisi.'

    setPaymentFieldErrors(nextErrors)
    const firstInvalidId = nextErrors.gross
      ? 'school-paid-gross'
      : nextErrors.deduction
        ? 'school-payment-deduction'
        : nextErrors.evidence
          ? 'school-payment-proof'
          : null
    if (firstInvalidId) document.getElementById(firstInvalidId)?.focus()
    return Object.keys(nextErrors).length === 0
  }

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPaymentFieldErrors({})
    if (!validatePayment()) return
    try {
      confirmSchoolPayment(order.id, {
        schoolPaidAmount: Number(grossAmount),
        deductionAmount: Number(deductionAmount),
        netReceivedAmount: derivedNet,
        method: paymentMethod,
        evidenceName: paymentEvidence,
      })
      setPaymentOpen(false)
      setFeedback('Pembayaran LUNAS dicatat. Benefit 10% kini wajib dibayar dari invoice gross.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pembayaran gagal dicatat.')
    }
  }

  const validateBenefit = (): boolean => {
    const nextErrors: BenefitFieldErrors = {}
    if (!recipient.trim()) nextErrors.recipient = 'Nama penerima wajib diisi.'
    if (benefitMethod === 'TRANSFER' && !accountReference.trim()) {
      nextErrors.accountReference = 'Referensi rekening/transfer wajib diisi untuk metode TRANSFER.'
    }
    if (!benefitProof.trim()) nextErrors.proof = 'Bukti benefit wajib diisi.'

    setBenefitFieldErrors(nextErrors)
    const firstInvalidId = nextErrors.recipient
      ? 'benefit-recipient'
      : nextErrors.accountReference
        ? 'benefit-account-reference'
        : nextErrors.proof
          ? 'benefit-proof'
          : null
    if (firstInvalidId) document.getElementById(firstInvalidId)?.focus()
    return Object.keys(nextErrors).length === 0
  }

  const submitBenefit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setBenefitFieldErrors({})
    if (benefitAmount === null || !validateBenefit()) return
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
      setFeedback('Benefit dibayar satu kali penuh.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Benefit gagal dicatat.')
    }
  }

  const openCloseReview = (event: MouseEvent<HTMLButtonElement>) => {
    closeTriggerRef.current = event.currentTarget
    setCloseConfirmed(false)
    setCloseConfirmationError(null)
    setCloseError(null)
    setCloseOpen(true)
  }

  const closeReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (closeSubmitting) return
    if (!closeConfirmed) {
      setCloseConfirmationError('Konfirmasi review syarat wajib dicentang.')
      document.getElementById('close-confirmation')?.focus()
      return
    }
    setCloseSubmitting(true)
    setCloseConfirmationError(null)
    setCloseError(null)
    try {
      closeSchoolOrder(order.id)
      setCloseOpen(false)
      setCloseConfirmed(false)
      setCloseSubmitting(false)
      setFeedback('Order ditutup setelah review syarat.')
    } catch (caught) {
      setCloseError(caught instanceof Error ? caught.message : 'Order gagal ditutup.')
      setCloseSubmitting(false)
    }
  }

  const cancelCloseReview = () => {
    if (closeSubmitting) return
    setCloseOpen(false)
    setCloseConfirmed(false)
    setCloseConfirmationError(null)
    setCloseError(null)
  }

  return (
    <div className="finance-workspace">
      {feedback ? <div className="callout callout--success" role="status">{feedback}</div> : null}
      {error && !paymentOpen && !benefitOpen ? <div className="callout callout--danger" role="alert"><strong>Tindakan gagal.</strong> {error}</div> : null}

      <div className="workspace-grid">
        <section className="workspace-panel payment-operations-panel">
          <div className="panel-heading">
            <div><h2>Pembayaran sekolah</h2><p>Gross adalah jumlah sebelum potongan; net adalah jumlah yang diterima JPA. Ini bukan pencatatan akuntansi.</p></div>
            <StatusChip tone={order.schoolPayment.status === 'LUNAS' ? 'success' : 'warning'}>{schoolPaymentStatusLabels[order.schoolPayment.status]}</StatusChip>
          </div>
          <div className="detail-list">
            <FinanceRow label="Invoice final gross" value={order.finalInvoiceAmount === null ? 'Belum ditetapkan' : formatCurrency(order.finalInvoiceAmount)} />
            <FinanceRow label="Gross dibayar sekolah" value={formatCurrency(order.schoolPayment.schoolPaidAmount)} />
            <FinanceRow label="Potongan settlement" detail="Platform, pajak, atau potongan lain pada settlement ini" value={formatCurrency(order.schoolPayment.deductionAmount)} />
            <FinanceRow label="Net diterima JPA" value={formatCurrency(order.schoolPayment.netReceivedAmount)} />
            <FinanceRow label="Tanggal" value={formatDate(order.schoolPayment.paidAt)} />
            <FinanceRow label="Metode" value={order.schoolPayment.method ? schoolPaymentMethodLabels[order.schoolPayment.method] ?? order.schoolPayment.method : '—'} />
            <FinanceRow label="Bukti" value={order.schoolPayment.evidenceName ?? 'Belum ada'} />
          </div>
          {order.stage !== 'CLOSED' && order.schoolPayment.status === 'UNPAID' && order.finalInvoiceAmount !== null ? (
            <Button onClick={() => { setError(null); setPaymentFieldErrors({}); setPaymentOpen(true) }}>Konfirmasi LUNAS</Button>
          ) : null}
        </section>

        <section className="workspace-panel benefit-operations-panel">
          <div className="panel-heading">
            <div><h2>Benefit sekolah</h2><p>Tepat 10% dari invoice final sebelum potongan (gross), bukan dari jumlah bersih (net settlement).</p></div>
            <StatusChip tone={order.benefit.status === 'PAID' ? 'success' : order.benefit.status === 'ELIGIBLE' ? 'warning' : 'neutral'}>{benefitStatusLabels[order.benefit.status]}</StatusChip>
          </div>
          <div className="benefit-amount">
            <span>Kewajiban {order.benefit.obligationAmount === null ? 'belum dibekukan' : 'dibekukan saat LUNAS'}</span>
            <strong>{benefitAmount === null ? '—' : formatCurrency(benefitAmount)}</strong>
          </div>
          <div className="detail-list">
            <FinanceRow label="Basis gross" value={order.benefit.baseAmount === null ? '—' : formatCurrency(order.benefit.baseAmount)} />
            <FinanceRow label="Dibayar" value={formatDate(order.benefit.paidAt)} />
            <FinanceRow label="Metode" value={order.benefit.method ? benefitPaymentMethodLabels[order.benefit.method] : '—'} />
            <FinanceRow label="Tipe penerima" value={order.benefit.recipientType ? benefitRecipientTypeLabels[order.benefit.recipientType] : '—'} />
            <FinanceRow label="Nama penerima" value={order.benefit.recipient ?? '—'} />
            <FinanceRow label="Referensi" value={order.benefit.accountReference ?? '—'} />
            <FinanceRow label="Konfirmasi sekolah" detail="Opsional; tidak memblokir penutupan" value={formatDate(order.benefit.schoolConfirmedAt)} />
          </div>
          {order.stage !== 'CLOSED' && order.benefit.status === 'ELIGIBLE' ? <Button onClick={() => { setError(null); setBenefitFieldErrors({}); setBenefitOpen(true) }}>Bayar benefit penuh</Button> : null}
          {order.benefit.status === 'PAID' && !order.benefit.schoolConfirmedAt && order.stage !== 'CLOSED' ? (
            <Button variant="secondary" onClick={() => run(() => confirmBenefitReceipt(order.id), 'Konfirmasi penerimaan benefit oleh sekolah dicatat.')}>Catat konfirmasi sekolah</Button>
          ) : null}
        </section>

        <section className="workspace-panel workspace-panel--wide supplier-summary">
          <div><span>Kewajiban supplier</span><strong>{order.supplierPayment.obligationAmount === null ? 'Belum ditetapkan' : formatCurrency(order.supplierPayment.obligationAmount)}</strong></div>
          <div><span>Sudah dibayar</span><strong>{formatCurrency(order.supplierPayment.paidAmount)}</strong></div>
          <div><span>Status</span><StatusChip tone={order.supplierPayment.status === 'PAID' ? 'success' : 'neutral'}>{supplierPaymentStatusLabels[order.supplierPayment.status]}</StatusChip></div>
          <p>Biaya supplier tidak dihitung dari ARKAS atau persentase. Sisa kewajiban supplier tidak memblokir penutupan order sekolah.</p>
        </section>
      </div>

      {order.schoolPayment.status === 'UNPAID' && order.stage !== 'CLOSED' ? (
        <section className="workspace-panel payment-reminder-panel">
          <div>
            <h2>Pengingat pembayaran</h2>
            <p>Belum dibayar tetap pasif sampai tanggal tindak lanjut eksplisit tercapai.</p>
          </div>
          <ReminderForm
            inputId={`payment-follow-up-${order.id}`}
            currentDueAt={order.schoolPayment.followUpDueAt}
            setupRequired
            setupTitle="Atur tindak lanjut pembayaran."
            setupDescription="Tanggal belum dikonfirmasi; kolom sudah diisi saran tiga hari dari hari ini. Simpan untuk mengaktifkan jadwal."
            savedTitle="Pengingat pembayaran tersimpan."
            savedDescription={(date) => `Tindak lanjut dijadwalkan pada ${date}.`}
            saveSuccessMessage="Pengingat pembayaran disimpan."
            clearSuccessMessage="Pengingat pembayaran dihapus."
            onSave={(dueAt) => setPaymentFollowUp(order.id, dueAt)}
            onClear={() => setPaymentFollowUp(order.id, null)}
            onBeforeAction={() => {
              setError(null)
              setFeedback(null)
            }}
            onCompleted={setFeedback}
          />
        </section>
      ) : null}

      {order.stage !== 'CLOSED' ? (
        <section className={closeReady ? 'workspace-panel closure-panel' : 'workspace-panel closure-panel closure-panel--blocked'}>
          <div>
            <h2>{closeReady ? 'Siap ditutup' : 'Penutupan order belum siap'}</h2>
            <p>{closeReady ? 'Tinjau semua syarat sebelum menutup order. Supplier tidak menjadi penghambat.' : 'Syarat yang belum selesai ditampilkan agar penutupan tidak dilakukan sebelum waktunya.'}</p>
          </div>
          <ClosureChecklist order={order} />
          {closeReady ? (
            <Button onClick={openCloseReview}>Review penutupan</Button>
          ) : (
            <div className="inline-clear-state inline-clear-state--neutral">Belum dapat ditutup. Lengkapi syarat wajib yang bertanda ○.</div>
          )}
        </section>
      ) : (
        <section className="workspace-panel closure-panel closure-panel--readonly">
          <div>
            <h2>Order selesai</h2>
            <p>Order sudah selesai dan workspace ini hanya baca. Riwayat tetap tersedia di Timeline.</p>
          </div>
          <ClosureChecklist order={order} />
          <div className="readonly-workflow-note">Jika perlu koreksi operasional, gunakan aksi “Buka kembali order” di atas sebelum mengubah syarat.</div>
        </section>
      )}

      <Modal
        open={closeOpen}
        title="Review penutupan order"
        description="Pastikan semua syarat wajib selesai sebelum order ditutup."
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
        <form id="close-review-form" className="form-stack" onSubmit={closeReview} noValidate>
          <ClosureChecklist order={order} />
          <label className="checkbox-field" htmlFor="close-confirmation">
            <input
              id="close-confirmation"
              type="checkbox"
              autoFocus
              data-autofocus="true"
              checked={closeConfirmed}
              onChange={(event) => {
                setCloseConfirmed(event.target.checked)
                setCloseConfirmationError(null)
                setCloseError(null)
              }}
              aria-invalid={Boolean(closeConfirmationError)}
              aria-describedby={closeConfirmationError ? 'close-confirmation-error' : undefined}
            />
            <span>Saya sudah meninjau syarat dan mengonfirmasi penutupan order ini.</span>
          </label>
          {closeConfirmationError ? <span id="close-confirmation-error" className="form-error" role="alert">{closeConfirmationError}</span> : null}
          {closeError ? <div className="callout callout--danger" role="alert"><strong>Order belum ditutup.</strong> {closeError}</div> : null}
        </form>
      </Modal>

      <Modal
        open={paymentOpen}
        title="Konfirmasi pembayaran LUNAS"
        description="Gross harus sama dengan invoice final. Potongan hanya mengurangi net diterima, bukan benefit basis."
        onClose={() => setPaymentOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setPaymentOpen(false)}>Batal</Button><Button type="submit" form="school-payment-form">Konfirmasi LUNAS</Button></>}
      >
        <form id="school-payment-form" className="form-stack" onSubmit={submitPayment} noValidate>
          {error ? <div className="callout callout--danger" role="alert"><strong>Pembayaran belum tersimpan.</strong> {error}</div> : null}
          <FormField label="Gross dibayar sekolah" htmlFor="school-paid-gross" error={paymentFieldErrors.gross}>
            <input
              id="school-paid-gross"
              type="number"
              min="0"
              value={grossAmount}
              onChange={(event) => {
                setGrossAmount(event.target.value)
                setPaymentFieldErrors({})
                setError(null)
              }}
              aria-invalid={Boolean(paymentFieldErrors.gross)}
              aria-describedby={paymentFieldErrors.gross ? 'school-paid-gross-error' : undefined}
              required
            />
          </FormField>
          <FormField label="Potongan settlement" htmlFor="school-payment-deduction" hint="Isi 0 untuk transfer langsung tanpa potongan." error={paymentFieldErrors.deduction}>
            <input
              id="school-payment-deduction"
              type="number"
              min="0"
              value={deductionAmount}
              onChange={(event) => {
                setDeductionAmount(event.target.value)
                setPaymentFieldErrors({})
                setError(null)
              }}
              aria-invalid={Boolean(paymentFieldErrors.deduction)}
              aria-describedby={paymentFieldErrors.deduction ? 'school-payment-deduction-error' : undefined}
              required
            />
          </FormField>
          <div className="derived-settlement"><span>Net diterima JPA</span><strong>{formatCurrency(derivedNet)}</strong><small>Gross − potongan</small></div>
          <FormField label="Metode" htmlFor="school-payment-method"><select id="school-payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="Transfer bank">{schoolPaymentMethodLabels['Transfer bank']}</option><option value="SIPLah settlement">{schoolPaymentMethodLabels['SIPLah settlement']}</option><option value="Cash">{schoolPaymentMethodLabels.Cash}</option></select></FormField>
          <FormField label="Bukti pembayaran" htmlFor="school-payment-proof" error={paymentFieldErrors.evidence}>
            <input
              id="school-payment-proof"
              value={paymentEvidence}
              onChange={(event) => {
                setPaymentEvidence(event.target.value)
                setPaymentFieldErrors({})
                setError(null)
              }}
              aria-invalid={Boolean(paymentFieldErrors.evidence)}
              aria-describedby={paymentFieldErrors.evidence ? 'school-payment-proof-error' : undefined}
              required
            />
          </FormField>
        </form>
      </Modal>

      <Modal
        open={benefitOpen}
        title="Bayar benefit penuh"
        description={`Nominal wajib tepat ${benefitAmount === null ? '—' : formatCurrency(benefitAmount)} dan tidak dapat dicicil.`}
        onClose={() => setBenefitOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setBenefitOpen(false)}>Batal</Button><Button type="submit" form="benefit-payment-form">Catat benefit sudah dibayar</Button></>}
      >
        <form id="benefit-payment-form" className="form-stack" onSubmit={submitBenefit} noValidate>
          {error ? <div className="callout callout--danger" role="alert"><strong>Benefit belum tersimpan.</strong> {error}</div> : null}
          <div className="derived-settlement"><span>Kewajiban benefit</span><strong>{benefitAmount === null ? '—' : formatCurrency(benefitAmount)}</strong><small>10% dari invoice final gross</small></div>
          <FormField label="Metode" htmlFor="benefit-method"><select id="benefit-method" value={benefitMethod} onChange={(event) => {
            const method = event.target.value as BenefitPaymentMethod
            setBenefitMethod(method)
            if (method === 'CASH') setAccountReference('')
            setBenefitFieldErrors({})
            setError(null)
          }}><option value="TRANSFER">{benefitPaymentMethodLabels.TRANSFER}</option><option value="CASH">{benefitPaymentMethodLabels.CASH}</option></select></FormField>
          <FormField label="Tipe penerima" htmlFor="benefit-recipient-type"><select id="benefit-recipient-type" value={recipientType} onChange={(event) => setRecipientType(event.target.value as BenefitRecipientType)}><option value="SCHOOL_OFFICIAL">{benefitRecipientTypeLabels.SCHOOL_OFFICIAL}</option><option value="INDIVIDUAL">{benefitRecipientTypeLabels.INDIVIDUAL}</option></select></FormField>
          <FormField label="Nama penerima" htmlFor="benefit-recipient" error={benefitFieldErrors.recipient}>
            <input
              id="benefit-recipient"
              value={recipient}
              onChange={(event) => {
                setRecipient(event.target.value)
                setBenefitFieldErrors({})
                setError(null)
              }}
              aria-invalid={Boolean(benefitFieldErrors.recipient)}
              aria-describedby={benefitFieldErrors.recipient ? 'benefit-recipient-error' : undefined}
              required
            />
          </FormField>
          {benefitMethod === 'TRANSFER' ? (
            <FormField label="Rekening / referensi transfer" htmlFor="benefit-account-reference" error={benefitFieldErrors.accountReference}>
              <input
                id="benefit-account-reference"
                value={accountReference}
                onChange={(event) => {
                  setAccountReference(event.target.value)
                  setBenefitFieldErrors({})
                  setError(null)
                }}
                aria-invalid={Boolean(benefitFieldErrors.accountReference)}
                aria-describedby={benefitFieldErrors.accountReference ? 'benefit-account-reference-error' : undefined}
                required
              />
            </FormField>
          ) : null}
          <FormField label="Bukti benefit" htmlFor="benefit-proof" error={benefitFieldErrors.proof}>
            <input
              id="benefit-proof"
              value={benefitProof}
              onChange={(event) => {
                setBenefitProof(event.target.value)
                setBenefitFieldErrors({})
                setError(null)
              }}
              aria-invalid={Boolean(benefitFieldErrors.proof)}
              aria-describedby={benefitFieldErrors.proof ? 'benefit-proof-error' : undefined}
              required
            />
          </FormField>
        </form>
      </Modal>
    </div>
  )
}
