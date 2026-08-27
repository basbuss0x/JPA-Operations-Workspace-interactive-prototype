import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/app-shell'
import { PipelinePage } from './routes/pipeline-page'
import { HomePage } from './routes/home-page'
import { HetReviewPage } from './routes/het-review-page'
import { NewOrderPage } from './routes/new-order-page'
import { NotFoundPage } from './routes/not-found-page'
import { OrdersPage } from './routes/orders-page'
import { OrderWorkspacePage } from './routes/order-workspace-page'
import { SiplahWorkflowPage } from './routes/siplah-workflow-page'
import { VendorBatchBuilderPage } from './routes/vendor-batch-builder-page'
import { VendorBatchDetailPage } from './routes/vendor-batch-detail-page'
import { VendorBatchesPage } from './routes/vendor-batches-page'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<NewOrderPage />} />
          <Route path="orders/:orderId" element={<OrderWorkspacePage />} />
          <Route path="orders/:orderId/arkas" element={<HetReviewPage />} />
          <Route path="orders/:orderId/siplah" element={<SiplahWorkflowPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="vendor-batches" element={<VendorBatchesPage />} />
          <Route path="vendor-batches/new" element={<VendorBatchBuilderPage />} />
          <Route path="vendor-batches/:batchId" element={<VendorBatchDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
