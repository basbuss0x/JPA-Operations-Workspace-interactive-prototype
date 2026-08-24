import { Link, useLocation } from 'react-router-dom'
import { EmptyState } from '../components/ui/empty-state'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'

const deferredContent = {
  '/pipeline': {
    eyebrow: 'Alternate view · TASK 13',
    title: 'Pipeline',
    description: 'Ringkasan bottleneck lintas order akan tetap menjadi view sekunder setelah workflow utama tervalidasi.',
    emptyTitle: 'Pipeline sengaja belum dibangun',
    emptyDescription: 'Pass 1 memprioritaskan Kerjakan Sekarang dan konteks per sekolah. Navigasi ini disiapkan agar struktur shell dapat direview.',
  },
  '/vendor-batches': {
    eyebrow: 'Vendor workspace · TASK 09–10',
    title: 'Vendor Batch',
    description: 'Batch Builder, agregasi lintas sekolah, recap Excel, dan lifecycle vendor masuk pada vertical slice berikutnya.',
    emptyTitle: 'Vendor execution ditunda setelah Review Gate 1',
    emptyDescription: 'State vendor dan batch fixture sudah ada, tetapi UI tidak akan menganggap DRAFT sebagai sudah dikirim.',
  },
} as const

export function DeferredPage() {
  const location = useLocation()
  const content = deferredContent[location.pathname as keyof typeof deferredContent] ?? deferredContent['/pipeline']
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
        actions={<StatusChip tone="info">Setelah Review Gate 1</StatusChip>}
      />
      <EmptyState
        title={content.emptyTitle}
        description={content.emptyDescription}
        action={<Link className="button button--primary button--md" to="/">Kembali ke Kerjakan Sekarang</Link>}
      />
    </div>
  )
}
