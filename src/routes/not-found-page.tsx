import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/empty-state'

export function NotFoundPage() {
  return (
    <EmptyState
      title="Halaman tidak ditemukan"
      description="Halaman ini belum tersedia dalam cakupan prototipe atau URL tidak valid."
      action={<Link className="button button--primary button--md" to="/">Kembali ke Home</Link>}
    />
  )
}
