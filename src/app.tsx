import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/app-shell'
import { DeferredPage } from './routes/deferred-page'
import { HomePage } from './routes/home-page'
import { NotFoundPage } from './routes/not-found-page'
import { OrdersPage } from './routes/orders-page'
import { OrderWorkspacePage } from './routes/order-workspace-page'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderWorkspacePage />} />
          <Route path="pipeline" element={<DeferredPage />} />
          <Route path="vendor-batches" element={<DeferredPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
