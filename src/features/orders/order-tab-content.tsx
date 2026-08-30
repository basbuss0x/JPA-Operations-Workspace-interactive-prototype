import { Link } from 'react-router-dom'
import {
  getHetExceptionCount,
  isSiplahAdminComplete,
  isSiplahReadyForVendor,
  isVendorBatchEligible,
} from '../../domain/selectors'
import {
  benefitStatusLabels,
  hetItemStatusLabels,
  hetReviewStatusLabels,
  vendorBatchStatusLabels,
} from '../../domain/presentation'
import type { Order, VendorBatch } from '../../domain/types'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'
import { ExceptionIndicator } from '../../components/ui/exception-indicator'
import { StatusChip } from '../../components/ui/status-chip'
import { OrderStateSummary } from '../../components/orders/order-state-summary'
import { DistributionWorkspace } from '../distribution/distribution-workspace'
import { FinanceWorkspace } from '../finance/finance-workspace'
import { OrderTimeline } from '../timeline/order-timeline'

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
            <p>Status penting tetap independen; tahap proses tidak menutupi masalah lain.</p>
          </div>
          {exceptions > 0 ? <ExceptionIndicator label={`${exceptions} penghambat HET`} level="danger" /> : null}
        </div>
        <OrderStateSummary order={order} batch={batch} />
      </section>

      <section className="workspace-panel">
        <div className="panel-heading">
          <div>
            <h2>Yang masih kurang</h2>
            <p>Hanya syarat yang perlu perhatian.</p>
          </div>
        </div>
        <div className="detail-list">
          {exceptions > 0 ? (
            <DetailRow label="HET" detail="Memblokir proses SIPLah" value={<StatusChip tone="danger">{exceptions} selisih</StatusChip>} />
          ) : null}
          {!isSiplahReadyForVendor(order) && order.het.status === 'APPROVED' ? (
            <DetailRow label="Pembelian SIPLah" detail="Syarat Vendor belum lengkap" value={<StatusChip tone="warning">Dalam proses</StatusChip>} />
          ) : null}
          {isSiplahReadyForVendor(order) && !isSiplahAdminComplete(order) ? (
            <DetailRow label="Administrasi SIPLah" detail="Invoice, Kwitansi, atau BAST masih menyusul" value={<StatusChip tone="warning">Belum lengkap</StatusChip>} />
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
          {order.schoolPayment.status === 'UNPAID' && order.finalInvoiceAmount !== null ? (
            <DetailRow
              label="Pembayaran sekolah"
              detail={order.schoolPayment.followUpDueAt ? `Pengingat ${formatDate(order.schoolPayment.followUpDueAt)}` : 'Belum ada pengingat tindak lanjut aktif'}
              value={<StatusChip tone="warning">Belum dibayar</StatusChip>}
            />
          ) : null}
          {order.benefit.status === 'ELIGIBLE' ? (
            <DetailRow label="Benefit" detail="10% dari invoice final" value={<StatusChip tone="warning">{benefitStatusLabels.ELIGIBLE}</StatusChip>} />
          ) : null}
          {exceptions === 0 &&
          isSiplahAdminComplete(order) &&
          (!order.goods.arrivedAt || order.goods.preDeliveryCheckCompleted) &&
          order.fulfillment.remainingQty === 0 &&
          order.schoolPayment.status === 'LUNAS' &&
          order.benefit.status !== 'ELIGIBLE' ? (
            <div className="inline-clear-state">✓ Tidak ada pengecualian operasional yang terbuka.</div>
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
          {hetReviewStatusLabels[order.het.status]}
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
                  label={hetItemStatusLabels[item.matchStatus]}
                  level={item.matchStatus === 'PRICE_MISMATCH' ? 'danger' : 'warning'}
                />
                <h3>{item.arkasTitle}</h3>
                <p>Usulan master: {item.masterProductTitle ?? 'Belum ada kecocokan'}</p>
              </div>
              <div className="exception-row__prices">
                <span>ARKAS {formatCurrency(item.arkasUnitPrice)}</span>
                <span>HET {item.hetUnitPrice ? formatCurrency(item.hetUnitPrice) : '—'}</span>
              </div>
            </article>
          ))}
          <div className="deferred-action-note">
            <strong>Pengecualian membutuhkan keputusan per item.</strong>
            <span>Tidak ada tombol generik yang akan melompati review dan persetujuan eksplisit.</span>
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
  const vendorDocuments = process.documents.filter((document) => document.requiredForVendorReady)
  const laterAdminDocuments = process.documents.filter((document) => document.requiredForAdminCompletion && !document.requiredForVendorReady)
  const optionalDocuments = process.documents.filter((document) => !document.requiredForVendorReady && !document.requiredForAdminCompletion)
  const completedLaterAdminDocuments = laterAdminDocuments.filter((document) =>
    document.available && Boolean(document.fileName) && document.verified && (!document.sendToSchoolRequired || document.sentToSchool),
  ).length

  return (
    <section className="workspace-panel focused-workflow">
      <div className="panel-heading">
        <div>
          <h2>Daftar periksa SIPLah</h2>
          <p>Setiap syarat merepresentasikan pekerjaan nyata; tidak ada penyimpanan kata sandi sekolah.</p>
        </div>
        <StatusChip tone={isSiplahReadyForVendor(order) ? 'success' : 'warning'}>
          {isSiplahReadyForVendor(order) ? 'Siap masuk Vendor Batch' : 'Belum siap Vendor'}
        </StatusChip>
      </div>
      <ol className="checklist">
        <ChecklistItem done={process.accessAvailable} label="Akses sekolah tersedia" detail="Kredensial asli tidak disimpan di prototipe." />
        <ChecklistItem done={process.orderPlaced} label="Pesanan dibuat di JPA/TokoLadang" />
        <ChecklistItem done={Boolean(process.orderNumber)} label="Nomor order SIPLah tercatat" detail={process.orderNumber ?? 'Belum ada nomor order'} />
        {vendorDocuments.map((document) => {
          const complete =
            document.available &&
            Boolean(document.fileName) &&
            document.verified &&
            (!document.sendToSchoolRequired || document.sentToSchool)
          const status = [
            'memblokir kesiapan Vendor',
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
          done={isSiplahReadyForVendor(order)}
          label="Siap masuk Vendor Batch"
          detail="Dihitung otomatis dari HET yang disetujui, akses, transaksi, nomor order, dan Surat Pesanan."
        />
        <ChecklistItem
          done={isSiplahAdminComplete(order)}
          label="Administrasi menyusul"
          detail={`${completedLaterAdminDocuments} dari ${laterAdminDocuments.length} dokumen lanjutan lengkap; Invoice, Kwitansi, dan BAST tidak memblokir Vendor.`}
        />
        {optionalDocuments.length > 0 ? (
          <ChecklistItem
            done={optionalDocuments.every((document) => document.available && Boolean(document.fileName) && document.verified)}
            label="Arsip PDF SIPLah (opsional)"
            detail="Tidak diperlukan untuk kesiapan Vendor atau penyelesaian administrasi."
          />
        ) : null}
      </ol>
      {!isSiplahReadyForVendor(order) ? (
        <div className="deferred-action-note">
          <strong>Lanjutkan syarat pembelian secara eksplisit.</strong>
          <span>Akses, nominal transaksi, nomor order, Surat Pesanan, lampiran, verifikasi, dan pengiriman tetap terpisah.</span>
          <Link className="button button--primary button--sm" to={`/orders/${order.id}/siplah`}>Buka alur SIPLah</Link>
        </div>
      ) : !isSiplahAdminComplete(order) ? (
        <div className="deferred-action-note">
          <strong>Siap untuk Vendor; administrasi SIPLah menyusul.</strong>
          <span>Invoice, Kwitansi, dan BAST tidak memblokir masuk Vendor Batch.</span>
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
          <p>Keanggotaan order dan tahap proses batch ditampilkan terpisah dari SIPLah.</p>
        </div>
        <StatusChip tone={batch ? 'info' : isVendorBatchEligible(order) ? 'warning' : 'neutral'}>
          {batch ? vendorBatchStatusLabels[batch.status] : isVendorBatchEligible(order) ? 'Siap masuk Vendor Batch' : 'Belum siap masuk Vendor Batch'}
        </StatusChip>
      </div>
      {batch ? (
        <div className="detail-list">
          <DetailRow label="Vendor Batch" value={<Link className="text-link" to={`/vendor-batches/${batch.id}`}>{batch.id} →</Link>} />
          <DetailRow label="Status batch" detail="Status ini tidak berasal dari tahap proses order" value={<StatusChip tone="info">{vendorBatchStatusLabels[batch.status]}</StatusChip>} />
          <DetailRow label="Anggota batch" detail="Ringkasan lengkap tersedia di ruang kerja batch" value={`${batch.orderIds.length} order`} />
          <DetailRow label="Dibuat" value={formatDate(batch.createdAt)} />
          <DetailRow label="Rekap dibuat" value={formatDate(batch.recapGeneratedAt)} />
          <DetailRow label="Dikirim ke vendor" value={formatDate(batch.sentAt)} />
          <DetailRow label="Barang tiba" value={formatDate(batch.arrivedAt)} />
          <DetailRow label="Pengingat tindak lanjut" value={formatDate(batch.followUpDueAt)} />
          <div className="deferred-action-note">
            <strong>{batch.status === 'RECAP_GENERATED' ? 'Rekap sudah dibuat, belum dikirim.' : 'Kelola pekerjaan pada tingkat batch.'}</strong>
            <span>Tindakan vendor lintas sekolah tidak diduplikasi di ruang kerja order ini.</span>
            <Link className="button button--secondary button--sm" to={`/vendor-batches/${batch.id}`}>Buka {batch.id}</Link>
          </div>
        </div>
      ) : isVendorBatchEligible(order) ? (
        <div className="callout callout--warning">
          <strong>Order siap direkap.</strong> Item sudah terstruktur dan dapat diagregasi bersama sekolah lain tanpa input ulang.
          <Link className="button button--primary button--sm" to="/vendor-batches/new">Buka penyusunan Vendor Batch</Link>
        </div>
      ) : (
        <div className="inline-clear-state inline-clear-state--neutral">Order belum memenuhi semua syarat Vendor Batch.</div>
      )}
    </section>
  )
}

function DistributionTab({ order, batch }: { order: Order; batch: VendorBatch | null }) {
  return <DistributionWorkspace order={order} batch={batch} />
}

function FinanceTab({ order }: { order: Order }) {
  return <FinanceWorkspace order={order} />
}

function TimelineTab({ order }: { order: Order }) {
  return <OrderTimeline order={order} />
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
      return <DistributionTab order={order} batch={batch} />
    case 'finance':
      return <FinanceTab order={order} />
    case 'timeline':
      return <TimelineTab order={order} />
  }
}
