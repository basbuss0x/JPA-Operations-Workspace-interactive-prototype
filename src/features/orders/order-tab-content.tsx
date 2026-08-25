import { Link } from 'react-router-dom'
import {
  calculateBenefitAmount,
  getHetExceptionCount,
  isSiplahAdminComplete,
  isSiplahComplete,
  isVendorBatchEligible,
} from '../../domain/selectors'
import type { Order, VendorBatch } from '../../domain/types'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'
import { ExceptionIndicator } from '../../components/ui/exception-indicator'
import { StatusChip } from '../../components/ui/status-chip'
import { OrderStateSummary } from '../../components/orders/order-state-summary'

export type OrderTab = 'overview' | 'arkas' | 'siplah' | 'vendor' | 'distribution' | 'finance' | 'timeline'

function DetailRow({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="detail-row">
      <div>
        <span className="detail-row__label">{label}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
      <div className="detail-row__value">{value}</div>
    </div>
  )
}

function ChecklistItem({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <li className="checklist__item">
      <span className={done ? 'checklist__check is-done' : 'checklist__check'} aria-hidden="true">
        {done ? '✓' : '○'}
      </span>
      <div>
        <strong>{label}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </li>
  )
}

function OverviewTab({ order, batch }: { order: Order; batch: VendorBatch | null }) {
  const exceptions = getHetExceptionCount(order)
  const latestEvents = [...order.timeline]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 3)

  return (
    <div className="workspace-grid">
      <section className="workspace-panel workspace-panel--wide">
        <div className="panel-heading">
          <div>
            <h2>Kondisi operasional</h2>
            <p>State penting tetap independen; posisi lifecycle tidak menutupi masalah lain.</p>
          </div>
          {exceptions > 0 ? <ExceptionIndicator label={`${exceptions} blocker HET`} level="danger" /> : null}
        </div>
        <OrderStateSummary order={order} batch={batch} />
      </section>

      <section className="workspace-panel">
        <div className="panel-heading">
          <div>
            <h2>Yang masih kurang</h2>
            <p>Hanya checkpoint yang perlu perhatian.</p>
          </div>
        </div>
        <div className="detail-list">
          {exceptions > 0 ? (
            <DetailRow label="HET" detail="Memblokir proses SIPLah" value={<StatusChip tone="danger">{exceptions} selisih</StatusChip>} />
          ) : null}
          {!isSiplahComplete(order) && order.het.status === 'APPROVED' ? (
            <DetailRow label="SIPLah" detail="Checklist belum lengkap" value={<StatusChip tone="warning">Dalam proses</StatusChip>} />
          ) : null}
          {order.goods.arrivedAt && !order.goods.preDeliveryCheckCompleted ? (
            <DetailRow label="Pemeriksaan barang" detail="Barang sudah di JPA" value={<StatusChip tone="warning">Belum dicek</StatusChip>} />
          ) : null}
          {order.fulfillment.remainingQty > 0 && order.goods.preDeliveryCheckCompleted ? (
            <DetailRow
              label="Distribusi"
              detail={`${order.fulfillment.problemCount} masalah dari tracker`}
              value={<StatusChip tone="warning">Sisa {order.fulfillment.remainingQty}</StatusChip>}
            />
          ) : null}
          {order.benefit.status === 'ELIGIBLE' ? (
            <DetailRow label="Benefit" detail="10% dari invoice final" value={<StatusChip tone="warning">Siap dibayar</StatusChip>} />
          ) : null}
          {exceptions === 0 &&
          isSiplahComplete(order) &&
          (!order.goods.arrivedAt || order.goods.preDeliveryCheckCompleted) &&
          order.fulfillment.remainingQty === 0 &&
          order.benefit.status !== 'ELIGIBLE' ? (
            <div className="inline-clear-state">✓ Tidak ada exception operasional yang terbuka.</div>
          ) : null}
        </div>
      </section>

      <section className="workspace-panel">
        <div className="panel-heading">
          <div>
            <h2>Kejadian terakhir</h2>
            <p>Konteks singkat tanpa mencari chat atau dokumen.</p>
          </div>
          <Link className="text-link" to={`?tab=timeline`}>Timeline lengkap →</Link>
        </div>
        <ol className="mini-timeline">
          {latestEvents.map((event) => (
            <li key={event.id}>
              <span className="mini-timeline__dot" />
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
                <time>{formatDateTime(event.occurredAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function ArkasTab({ order }: { order: Order }) {
  const exceptions = order.items.filter((item) =>
    ['PRICE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH'].includes(item.matchStatus),
  )
  const difference = order.hetReviewedAmount === null
    ? null
    : order.hetReviewedAmount - order.arkasBudgetAmount
  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div>
          <h2>ARKAS & Review HET</h2>
          <p>{order.arkas.fileName} · {order.arkas.reference}</p>
        </div>
        <StatusChip tone={exceptions.length > 0 ? 'danger' : 'success'}>
          {order.het.status.replaceAll('_', ' ')}
        </StatusChip>
      </div>

      <div className="exception-summary">
        <div><strong>{order.het.detectedItemCount}</strong><span>item terdeteksi</span></div>
        <div><strong>{order.het.autoMatchedItemCount}</strong><span>cocok otomatis</span></div>
        <div className={exceptions.length > 0 ? 'is-warning' : ''}>
          <strong>{exceptions.length}</strong><span>perlu keputusan</span>
        </div>
      </div>

      {exceptions.length > 0 ? (
        <div className="exception-list">
          {exceptions.map((item) => (
            <article className="exception-row" key={item.id}>
              <div>
                <ExceptionIndicator
                  label={item.matchStatus === 'PRICE_MISMATCH' ? 'Harga berbeda' : 'Match ambigu'}
                  level={item.matchStatus === 'PRICE_MISMATCH' ? 'danger' : 'warning'}
                />
                <h3>{item.arkasTitle}</h3>
                <p>Usulan master: {item.masterProductTitle ?? 'Belum ada match'}</p>
              </div>
              <div className="exception-row__prices">
                <span>ARKAS {formatCurrency(item.arkasUnitPrice)}</span>
                <span>HET {item.hetUnitPrice ? formatCurrency(item.hetUnitPrice) : '—'}</span>
              </div>
            </article>
          ))}
          <div className="deferred-action-note">
            <strong>Exception membutuhkan keputusan per item.</strong>
            <span>Tidak ada tombol generik yang akan melompati review dan approval eksplisit.</span>
            <Link className="button button--primary button--sm" to={`/orders/${order.id}/arkas`}>Buka Review HET</Link>
          </div>
        </div>
      ) : (
        <div className="inline-clear-state">✓ Semua item HET sudah dikonfirmasi.</div>
      )}

      <div className="totals-strip">
        <div><span>Anggaran ARKAS</span><strong>{formatCurrency(order.arkasBudgetAmount)}</strong></div>
        <div><span>Hasil review HET</span><strong>{order.hetReviewedAmount === null ? '—' : formatCurrency(order.hetReviewedAmount)}</strong></div>
        <div className={difference !== null && difference !== 0 ? 'is-warning' : ''}>
          <span>Selisih</span><strong>{difference === null ? '—' : formatCurrency(Math.abs(difference))}</strong>
        </div>
      </div>
    </section>
  )
}

function SiplahTab({ order }: { order: Order }) {
  const process = order.siplah
  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div>
          <h2>Checklist SIPLah</h2>
          <p>Setiap checkpoint merepresentasikan pekerjaan nyata; tidak ada penyimpanan password sekolah.</p>
        </div>
        <StatusChip tone={isSiplahComplete(order) ? 'success' : 'warning'}>
          {isSiplahComplete(order) ? 'Selesai' : 'Belum lengkap'}
        </StatusChip>
      </div>
      <ol className="checklist">
        <ChecklistItem done={process.accessAvailable} label="Akses sekolah tersedia" detail="Kredensial asli tidak disimpan di prototype." />
        <ChecklistItem done={process.orderPlaced} label="Pesanan dibuat di JPA/TokoLadang" />
        <ChecklistItem done={Boolean(process.orderNumber)} label="Nomor order SIPLah tercatat" detail={process.orderNumber ?? 'Belum ada nomor order'} />
        {process.documents.map((document) => {
          const complete =
            document.available &&
            Boolean(document.fileName) &&
            document.verified &&
            (!document.sendToSchoolRequired || document.sentToSchool)
          const status = [
            document.required ? 'Wajib' : 'Opsional',
            document.available ? 'tersedia' : 'belum tersedia',
            document.fileName ? 'terlampir' : 'belum terlampir',
            document.verified ? 'terverifikasi' : 'belum diverifikasi',
            document.sendToSchoolRequired
              ? document.sentToSchool ? 'sudah dikirim' : 'belum dikirim'
              : null,
          ].filter(Boolean).join(' · ')
          return <ChecklistItem key={document.kind} done={complete} label={document.label} detail={status} />
        })}
        <ChecklistItem
          done={isSiplahAdminComplete(order)}
          label="Administrasi SIPLah terverifikasi"
          detail="Derived dari order SIPLah dan seluruh dokumen wajib; bukan checkbox manual."
        />
      </ol>
      {!isSiplahComplete(order) ? (
        <div className="deferred-action-note">
          <strong>Lanjutkan checkpoint secara eksplisit.</strong>
          <span>Akses, order number, attachment, verifikasi, dan pengiriman dokumen tetap terpisah.</span>
          <Link className="button button--primary button--sm" to={`/orders/${order.id}/siplah`}>Buka Workflow SIPLah</Link>
        </div>
      ) : null}
    </section>
  )
}

function VendorTab({ order, batch }: { order: Order; batch: VendorBatch | null }) {
  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div>
          <h2>Konteks Vendor</h2>
          <p>Keanggotaan order dan lifecycle batch ditampilkan terpisah dari SIPLah.</p>
        </div>
        <StatusChip tone={batch ? 'info' : isVendorBatchEligible(order) ? 'warning' : 'neutral'}>
          {batch?.status.replaceAll('_', ' ') ?? (isVendorBatchEligible(order) ? 'Siap masuk batch' : 'Belum eligible')}
        </StatusChip>
      </div>
      {batch ? (
        <div className="detail-list">
          <DetailRow label="Vendor Batch" value={batch.id} />
          <DetailRow label="Status batch" detail="Status ini tidak berasal dari lifecycle order" value={<StatusChip tone="info">{batch.status.replaceAll('_', ' ')}</StatusChip>} />
          <DetailRow label="Dibuat" value={formatDate(batch.createdAt)} />
          <DetailRow label="Dikirim ke vendor" value={formatDate(batch.sentAt)} />
          <DetailRow label="Barang tiba" value={formatDate(batch.arrivedAt)} />
          <DetailRow label="Reminder follow-up" value={formatDate(batch.followUpDueAt)} />
        </div>
      ) : isVendorBatchEligible(order) ? (
        <div className="callout callout--warning">
          <strong>Order siap direkap.</strong> Item sudah terstruktur dan dapat diagregasi bersama sekolah lain tanpa input ulang. Batch Builder sengaja ditunda ke TASK 09.
        </div>
      ) : (
        <div className="inline-clear-state inline-clear-state--neutral">Order belum memenuhi semua syarat Vendor Batch.</div>
      )}
    </section>
  )
}

function DistributionTab({ order }: { order: Order }) {
  const fulfillment = order.fulfillment
  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div>
          <h2>Barang & Distribusi</h2>
          <p>Ringkasan dari Kelengkapan Buku Tracker; detail judul tetap dikelola di aplikasi tersebut.</p>
        </div>
        <StatusChip tone={fulfillment.progressPercent === 100 ? 'success' : order.goods.arrivedAt ? 'warning' : 'neutral'}>
          {fulfillment.progressPercent}% terpenuhi
        </StatusChip>
      </div>
      <div className="progress-block">
        <div className="progress-block__head"><span>Progres distribusi</span><strong>{fulfillment.deliveredQty} / {fulfillment.orderedQty} buku</strong></div>
        <div className="progress-track"><span style={{ width: `${fulfillment.progressPercent}%` }} /></div>
      </div>
      <div className="detail-list">
        <DetailRow label="Barang tiba di JPA" value={formatDate(order.goods.arrivedAt)} />
        <DetailRow label="Pemeriksaan pra-kirim" value={<StatusChip tone={order.goods.preDeliveryCheckCompleted ? 'success' : 'warning'}>{order.goods.preDeliveryCheckCompleted ? 'Selesai' : 'Belum dilakukan'}</StatusChip>} />
        <DetailRow label="Sisa pengantaran" value={`${fulfillment.remainingQty} buku`} />
        <DetailRow label="Masalah dari tracker" value={`${fulfillment.problemCount} masalah`} />
        <DetailRow label="Sinkron terakhir" value={`${formatDate(fulfillment.lastUpdated)} · ${fulfillment.syncStatus}`} />
      </div>
      <button className="button button--secondary button--md" type="button" disabled>
        Buka Kelengkapan Tracker · simulasi Pass 4
      </button>
    </section>
  )
}

function FinanceTab({ order }: { order: Order }) {
  const benefitAmount = calculateBenefitAmount(order)
  return (
    <div className="workspace-grid">
      <section className="workspace-panel">
        <div className="panel-heading">
          <div><h2>Pembayaran sekolah</h2><p>Operasional, bukan ledger accounting.</p></div>
          <StatusChip tone={order.schoolPayment.status === 'LUNAS' ? 'success' : 'warning'}>{order.schoolPayment.status}</StatusChip>
        </div>
        <div className="detail-list">
          <DetailRow label="Anggaran ARKAS" value={formatCurrency(order.arkasBudgetAmount)} />
          <DetailRow label="Hasil review HET" value={order.hetReviewedAmount === null ? '—' : formatCurrency(order.hetReviewedAmount)} />
          <DetailRow label="Invoice final" value={order.finalInvoiceAmount === null ? 'Belum ditetapkan' : formatCurrency(order.finalInvoiceAmount)} />
          <DetailRow label="Diterima sekolah" value={formatCurrency(order.schoolPayment.schoolPaidAmount)} />
          <DetailRow label="Tanggal" value={formatDate(order.schoolPayment.paidAt)} />
          <DetailRow label="Metode" value={order.schoolPayment.method ?? '—'} />
          <DetailRow label="Bukti" value={order.schoolPayment.evidenceName ?? 'Belum ada'} />
        </div>
      </section>
      <section className="workspace-panel">
        <div className="panel-heading">
          <div><h2>Benefit sekolah</h2><p>Tepat 10% dari invoice final, dibayar satu kali penuh.</p></div>
          <StatusChip tone={order.benefit.status === 'PAID' ? 'success' : order.benefit.status === 'ELIGIBLE' ? 'warning' : 'neutral'}>{order.benefit.status.replaceAll('_', ' ')}</StatusChip>
        </div>
        <div className="benefit-amount">
          <span>Nominal benefit {order.benefit.obligationAmount === null ? '(belum dibekukan)' : '(dibekukan saat LUNAS)'}</span>
          <strong>{benefitAmount === null ? '—' : formatCurrency(benefitAmount)}</strong>
        </div>
        <div className="detail-list">
          <DetailRow label="Eligible sejak" value={formatDate(order.benefit.eligibleAt)} />
          <DetailRow label="Dibayar" value={formatDate(order.benefit.paidAt)} />
          <DetailRow label="Penerima" value={order.benefit.recipient ?? '—'} />
        </div>
        {order.benefit.status === 'ELIGIBLE' ? (
          <div className="deferred-action-note">
            <strong>Benefit belum otomatis dibayar.</strong>
            <span>Form pencatatan pembayaran benefit akan diuji pada TASK 12.</span>
          </div>
        ) : null}
      </section>
      <section className="workspace-panel workspace-panel--wide supplier-summary">
        <div><span>Tagihan supplier</span><strong>{formatCurrency(order.supplierPayment.obligationAmount)}</strong></div>
        <div><span>Sudah dibayar</span><strong>{formatCurrency(order.supplierPayment.paidAmount)}</strong></div>
        <div><span>Status</span><StatusChip tone={order.supplierPayment.status === 'PAID' ? 'success' : 'neutral'}>{order.supplierPayment.status}</StatusChip></div>
        <p>Supplier outstanding tidak memblokir penutupan order sisi JPA.</p>
      </section>
    </div>
  )
}

function TimelineTab({ order }: { order: Order }) {
  const events = [...order.timeline].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div><h2>Timeline order</h2><p>Riwayat otomatis dan catatan operator untuk memulihkan konteks.</p></div>
        <StatusChip>{events.length} event</StatusChip>
      </div>
      <ol className="timeline-list">
        {events.map((event) => (
          <li key={event.id}>
            <div className={event.type === 'NOTE' ? 'timeline-list__marker is-note' : 'timeline-list__marker'} />
            <div className="timeline-list__content">
              <div><strong>{event.title}</strong><StatusChip tone={event.type === 'NOTE' ? 'info' : 'neutral'}>{event.type === 'NOTE' ? 'Catatan' : 'Otomatis'}</StatusChip></div>
              <p>{event.detail}</p>
              <time>{formatDateTime(event.occurredAt)}</time>
            </div>
          </li>
        ))}
      </ol>
      <div className="deferred-action-note">
        <strong>Timeline event sudah dibuat oleh transition engine.</strong>
        <span>Form catatan/reminder lengkap sengaja ditunda ke TASK 15.</span>
      </div>
    </section>
  )
}

export function OrderTabContent({
  tab,
  order,
  batch,
}: {
  tab: OrderTab
  order: Order
  batch: VendorBatch | null
}) {
  switch (tab) {
    case 'overview':
      return <OverviewTab order={order} batch={batch} />
    case 'arkas':
      return <ArkasTab order={order} />
    case 'siplah':
      return <SiplahTab order={order} />
    case 'vendor':
      return <VendorTab order={order} batch={batch} />
    case 'distribution':
      return <DistributionTab order={order} />
    case 'finance':
      return <FinanceTab order={order} />
    case 'timeline':
      return <TimelineTab order={order} />
  }
}
