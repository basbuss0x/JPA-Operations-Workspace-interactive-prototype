import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { usePrototypeStore } from '../../store/use-prototype-store'
import { Button } from '../ui/button'
import { Modal } from '../ui/modal'

const navigation = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/orders', label: 'Pesanan', icon: '▤', end: false },
  { to: '/pipeline', label: 'Pipeline', icon: '⇥', end: false },
  { to: '/vendor-batches', label: 'Vendor', icon: '▦', end: false },
]

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav className={mobile ? 'mobile-nav' : 'sidebar__nav'} aria-label="Navigasi utama">
      {navigation.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `${mobile ? 'mobile-nav__link' : 'sidebar__link'} ${isActive ? 'is-active' : ''}`
          }
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const [resetOpen, setResetOpen] = useState(false)
  const resetDemoData = usePrototypeStore((state) => state.resetDemoData)

  const confirmReset = () => {
    resetDemoData()
    setResetOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">J</div>
          <div>
            <strong>JPA Operations</strong>
            <span>Workspace prototype</span>
          </div>
        </div>
        <Navigation />
        <div className="sidebar__foot">
          <span className="prototype-dot" />
          Demo lokal · Pass 5
        </div>
      </aside>

      <div className="app-shell__body">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand__mark">J</span>
            <strong>JPA Operations</strong>
          </div>
          <div className="topbar__context">
            <span className="prototype-dot" />
            State demo tersimpan lokal
          </div>
          <Button className="topbar__reset" variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
            Reset Demo Data
          </Button>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <Navigation mobile />

      <Modal
        open={resetOpen}
        title="Reset Demo Data?"
        description="Semua perubahan lokal akan dihapus dan skenario canonical dikembalikan."
        onClose={() => setResetOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Batal</Button>
            <Button variant="danger" onClick={confirmReset}>Reset sekarang</Button>
          </>
        }
      >
        <div className="callout callout--warning">
          HET exception yang diselesaikan, snooze, override, batch baru, pembayaran, dan catatan demo akan hilang.
        </div>
      </Modal>
    </div>
  )
}
