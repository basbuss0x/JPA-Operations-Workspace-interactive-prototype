import type { VendorRecap } from '../../domain/types'
import { StatusChip } from '../../components/ui/status-chip'

export function VendorRecapView({ recap }: { recap: VendorRecap }) {
  return (
    <div className="vendor-recap-view">
      <section className="workspace-panel vendor-recap-section" aria-labelledby="aggregate-title">
        <div className="panel-heading">
          <div>
            <h2 id="aggregate-title">Ringkasan Vendor</h2>
            <p>Jumlah digabung berdasarkan kode produk stabil dari item order yang dipilih.</p>
          </div>
          <StatusChip tone="info">{recap.totalQuantity} buku</StatusChip>
        </div>

        <div className="vendor-aggregate-table-wrap">
          <table className="vendor-aggregate-table">
            <thead>
              <tr><th>Kode</th><th>Nama buku</th><th>Total jumlah</th><th>Sekolah</th></tr>
            </thead>
            <tbody>
              {recap.aggregatedItems.map((item) => (
                <tr key={item.productCode} data-product-code={item.productCode}>
                  <td><strong>{item.productCode}</strong></td>
                  <td>{item.title}</td>
                  <td><strong>{item.totalQuantity}</strong></td>
                  <td>
                    <details className="allocation-details">
                      <summary>{item.schools.length} sekolah</summary>
                      <ul>
                        {item.schools.map((school) => (
                          <li key={school.orderId}><span>{school.schoolName}</span><strong>{school.quantity}</strong></li>
                        ))}
                      </ul>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="vendor-aggregate-cards">
          {recap.aggregatedItems.map((item) => (
            <details className="vendor-product-card" key={item.productCode} data-product-code={item.productCode}>
              <summary>
                <span><strong>{item.productCode}</strong><small>{item.title}</small></span>
                <span className="vendor-product-card__total"><strong>{item.totalQuantity}</strong><small>{item.schools.length} sekolah · lihat alokasi</small></span>
              </summary>
              <div>
                <span className="detail-row__label">Alokasi {item.schools.length} sekolah</span>
                <ul>
                  {item.schools.map((school) => (
                    <li key={school.orderId}><span>{school.schoolName}</span><strong>{school.quantity}</strong></li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="workspace-panel vendor-recap-section" aria-labelledby="school-breakdown-title">
        <div className="panel-heading">
          <div>
            <h2 id="school-breakdown-title">Rincian sekolah</h2>
            <p>Alokasi per sekolah berasal dari data item yang sama dengan ringkasan vendor.</p>
          </div>
          <StatusChip>{recap.schoolCount} sekolah</StatusChip>
        </div>
        <div className="school-breakdown-grid">
          {recap.schoolBreakdown.map((school) => (
            <article className="school-allocation" key={school.orderId} data-order-id={school.orderId}>
              <header>
                <div><h3>{school.schoolName}</h3><p>{school.orderId} · {school.siplahOrderNumber}</p></div>
                <strong>{school.items.reduce((total, item) => total + item.quantity, 0)} buku</strong>
              </header>
              <ul>
                {school.items.map((item) => (
                  <li key={item.productCode}>
                    <span><strong>{item.productCode}</strong><small>{item.title}</small></span>
                    <strong>{item.quantity}</strong>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
