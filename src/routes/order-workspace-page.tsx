import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { deriveNextAction } from '../domain/next-action'
import { getHetExceptionCount, getOrderBatch } from '../domain/selectors'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab: OrderTab = isOrderTab(requestedTab) ? requestedTab : 'overview'
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideTitle, setOverrideTitle] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideDue, setOverrideDue] = useState('')

  const batch = order ? getOrderBatch(order, vendorBatches) : null
  const nextAction = useMemo(
    () => (order ? deriveNextAction(order, batch) : null),
    [batch, order],
  )

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
        snoozedUntil={order.nextActionControl.snoozedUntil}
        onSnooze={nextAction ? () => snoozeNextAction([order.id], futureIsoDate(3)) : undefined}
        onUnsnooze={order.nextActionControl.snoozedUntil ? () => snoozeNextAction([order.id], null) : undefined}
        onCustomize={order.stage !== 'CLOSED' ? openOverride : undefined}
      />

      <Tabs items={tabs} active={activeTab} onChange={selectTab} label="Bagian order workspace" />
      <OrderTabContent tab={activeTab} order={order} batch={batch} />

      <Modal
        open={overrideOpen}
        title="Atur Next Action manual"
        description="Override mengubah rekomendasi yang tampil, bukan state HET, SIPLah, vendor, atau pembayaran."
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
