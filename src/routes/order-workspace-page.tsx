import { useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { derivePrimaryNextAction } from '../domain/next-action'
import { getHetExceptionCount, getOrderActionCandidates, getOrderBatch } from '../domain/selectors'
import { lifecycleLabels } from '../domain/types'
import { OrderTabContent, type OrderTab } from '../features/orders/order-tab-content'
import { usePrototypeStore } from '../store/use-prototype-store'
import { futureIsoDate } from '../utils/format'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { ExceptionIndicator } from '../components/ui/exception-indicator'
import { FormField } from '../components/ui/form-field'
import { Modal } from '../components/ui/modal'
import { StatusChip } from '../components/ui/status-chip'
import { Tabs } from '../components/ui/tabs'
import { NextActionPanel } from '../components/work-queue/next-action-panel'
import { OutstandingActions } from '../components/work-queue/outstanding-actions'

const tabs: Array<{ id: OrderTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'arkas', label: 'ARKAS & HET' },
  { id: 'siplah', label: 'SIPLah' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'distribution', label: 'Barang & Distribusi' },
  { id: 'finance', label: 'Pembayaran' },
  { id: 'timeline', label: 'Timeline' },
]

function isOrderTab(value: string | null): value is OrderTab {
  return tabs.some((tab) => tab.id === value)
}

function toDateInput(value: string | null): string {
  return value?.slice(0, 10) ?? ''
}

export function OrderWorkspacePage() {
  const { orderId } = useParams()
  const order = usePrototypeStore((state) => (orderId ? state.orders[orderId] : undefined))
  const vendorBatches = usePrototypeStore((state) => state.vendorBatches)
  const snoozeNextAction = usePrototypeStore((state) => state.snoozeNextAction)
  const saveNextActionOverride = usePrototypeStore((state) => state.saveNextActionOverride)
  const reopenSchoolOrder = usePrototypeStore((state) => state.reopenSchoolOrder)
  const [searchParams, setSearchParams] = useSearchParams()
  const [renderedAt] = useState(() => new Date())
  const requestedTab = searchParams.get('tab')
  const activeTab: OrderTab = isOrderTab(requestedTab) ? requestedTab : 'overview'
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideTitle, setOverrideTitle] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideDue, setOverrideDue] = useState('')
  const [reopenOpen, setReopenOpen] = useState(false)
  const reopenTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [reopenReason, setReopenReason] = useState('')
  const [reopenError, setReopenError] = useState<string | null>(null)
  const [reopenSubmitting, setReopenSubmitting] = useState(false)

  const batch = order ? getOrderBatch(order, vendorBatches) : null
  const actionCandidates = useMemo(
    () => order ? getOrderActionCandidates(order, vendorBatches, renderedAt) : [],
    [order, renderedAt, vendorBatches],
  )
  const nextAction = derivePrimaryNextAction(actionCandidates)
  const otherActions = actionCandidates.filter((action) => action.id !== nextAction?.id)

  if (!order) {
    return (
      <EmptyState
        title="Order tidak ditemukan"
        description="ID order tidak ada di demo state atau data lokal sudah tidak kompatibel."
        action={<Link className="button button--secondary button--md" to="/orders">Kembali ke Pesanan</Link>}
      />
    )
  }

  const exceptions = getHetExceptionCount(order)
  const selectTab = (tab: OrderTab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'overview') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const openOverride = () => {
    setOverrideTitle(order.nextActionControl.override?.title ?? '')
    setOverrideReason(order.nextActionControl.override?.reason ?? '')
    setOverrideDue(toDateInput(order.nextActionControl.override?.dueAt ?? null))
    setOverrideOpen(true)
  }

  const submitOverride = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!overrideTitle.trim()) return
    saveNextActionOverride(order.id, {
      title: overrideTitle.trim(),
      reason: overrideReason.trim(),
      dueAt: overrideDue ? `${overrideDue}T08:00:00.000Z` : null,
    })
    setOverrideOpen(false)
  }

  const clearOverride = () => {
    saveNextActionOverride(order.id, null)
    setOverrideOpen(false)
  }

  const openReopen = (event: MouseEvent<HTMLButtonElement>) => {
    reopenTriggerRef.current = event.currentTarget
    setReopenReason('')
    setReopenError(null)
    setReopenOpen(true)
  }

  const submitReopen = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedReason = reopenReason.trim()
    if (!trimmedReason) {
      setReopenError('Alasan membuka kembali order wajib diisi.')
      return
    }
    if (reopenSubmitting) return
    setReopenSubmitting(true)
    setReopenError(null)
    try {
      reopenSchoolOrder(order.id, trimmedReason)
      setReopenOpen(false)
      setReopenReason('')
      setReopenSubmitting(false)
    } catch (caught) {
      setReopenError(caught instanceof Error ? caught.message : 'Order gagal dibuka kembali.')
      setReopenSubmitting(false)
    }
  }

  const cancelReopen = () => {
    if (reopenSubmitting) return
    setReopenOpen(false)
    setReopenError(null)
  }

  return (
    <div className="page-stack order-workspace">
      <Link className="back-link" to="/orders">← Semua Pesanan</Link>

      <header className="order-header">
        <div>
          <div className="order-header__meta">
            <span>{order.id}</span>
            <StatusChip tone={order.stage === 'CLOSED' ? 'success' : 'neutral'} dot>
              {lifecycleLabels[order.stage]}
            </StatusChip>
            {exceptions > 0 ? <ExceptionIndicator label={`${exceptions} exception`} level="danger" /> : null}
          </div>
          <h1>{order.schoolName}</h1>
          <p>{order.arkas.reference} · Diperbarui dari state operasional tersimpan</p>
        </div>
      </header>

      <NextActionPanel
        action={nextAction}
        emptyState={order.stage === 'CLOSED' ? {
          title: 'Order selesai',
          description: 'Order sudah CLOSED dan tidak memiliki tindakan aktif. Buka Timeline untuk melihat riwayat lengkap.',
        } : undefined}
        onSnooze={nextAction
          ? () => snoozeNextAction([order.id], nextAction.kind, futureIsoDate(3))
          : undefined}
        onCustomize={order.stage !== 'CLOSED' ? openOverride : undefined}
      />

      {order.stage === 'CLOSED' ? (
        <section className="workspace-panel closed-order-recovery" aria-labelledby="closed-order-recovery-title">
          <div>
            <h2 id="closed-order-recovery-title">Pemulihan order</h2>
            <p>Workspace tetap read-only. Jika ada koreksi operasional yang disetujui, buka kembali dengan alasan yang tercatat di Timeline.</p>
          </div>
          <Button variant="secondary" onClick={openReopen}>Buka kembali order</Button>
        </section>
      ) : null}

      <OutstandingActions
        actions={otherActions}
        onSnooze={(kind) => snoozeNextAction([order.id], kind, futureIsoDate(3))}
        onUnsnooze={(kind) => snoozeNextAction([order.id], kind, null)}
      />

      <Tabs items={tabs} active={activeTab} onChange={selectTab} label="Bagian order workspace" />
      <OrderTabContent tab={activeTab} order={order} batch={batch} />

      <Modal
        open={reopenOpen}
        title="Buka kembali order"
        description="Order akan kembali ke tahap aktif yang diturunkan dari checkpoint saat ini; riwayat penutupan tidak dihapus."
        onClose={cancelReopen}
        restoreFocusRef={reopenTriggerRef}
        footer={
          <>
            <Button variant="ghost" onClick={cancelReopen}>Batal</Button>
            <Button type="submit" form="reopen-order-form" disabled={reopenSubmitting}>
              {reopenSubmitting ? 'Membuka…' : 'Konfirmasi buka kembali'}
            </Button>
          </>
        }
      >
        <form id="reopen-order-form" className="form-stack" onSubmit={submitReopen}>
          <FormField
            label="Alasan membuka kembali order (wajib)"
            htmlFor="reopen-order-reason"
            hint="Contoh: koreksi bukti pembayaran sebelum audit internal."
          >
            <textarea
              id="reopen-order-reason"
              value={reopenReason}
              onChange={(event) => {
                setReopenReason(event.target.value)
                setReopenError(null)
              }}
              aria-invalid={Boolean(reopenError)}
              aria-describedby={reopenError ? 'reopen-order-error' : undefined}
              rows={4}
              autoFocus
              data-autofocus="true"
            />
            {reopenError ? <span id="reopen-order-error" className="form-error" role="alert">{reopenError}</span> : null}
          </FormField>
        </form>
      </Modal>

      <Modal
        open={overrideOpen}
        title="Atur Next Action manual"
        description="Aksi manual dapat dipin sebagai primary, tetapi kewajiban system tetap terlihat dan domain state tidak berubah."
        onClose={() => setOverrideOpen(false)}
        footer={
          <>
            {order.nextActionControl.override ? (
              <Button variant="danger" onClick={clearOverride}>Hapus override</Button>
            ) : <span />}
            <Button type="submit" form="override-form">Simpan next action</Button>
          </>
        }
      >
        <form id="override-form" className="form-stack" onSubmit={submitOverride}>
          <FormField label="Next action" htmlFor="override-title">
            <input
              id="override-title"
              value={overrideTitle}
              onChange={(event) => setOverrideTitle(event.target.value)}
              placeholder="Contoh: Hubungi kepala sekolah"
              required
              autoFocus
            />
          </FormField>
          <FormField label="Alasan / konteks" htmlFor="override-reason">
            <textarea
              id="override-reason"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Kenapa tindakan ini lebih penting dari rekomendasi sistem?"
              rows={3}
            />
          </FormField>
          <FormField label="Jatuh tempo" htmlFor="override-due" hint="Opsional; tidak mengubah lifecycle order.">
            <input id="override-due" type="date" value={overrideDue} onChange={(event) => setOverrideDue(event.target.value)} />
          </FormField>
        </form>
      </Modal>
    </div>
  )
}
