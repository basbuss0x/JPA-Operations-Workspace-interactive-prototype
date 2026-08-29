import { getClosureChecklist } from '../../domain/order-state'
import type { Order } from '../../domain/types'

export function ClosureChecklist({ order }: { order: Order }) {
  const checklist = getClosureChecklist(order)
  const blocking = checklist.filter((item) => item.blocking)
  const nonBlocking = checklist.filter((item) => !item.blocking)

  return (
    <div className="closure-checklist" aria-label="Checklist penutupan order">
      <div className="closure-checklist__group">
        <h3>Wajib sebelum ditutup</h3>
        <ul>
          {blocking.map((item) => (
            <li className={item.complete ? 'closure-checklist__item is-complete' : 'closure-checklist__item'} key={item.key}>
              <span className="closure-checklist__mark" aria-hidden="true">{item.complete ? '✓' : '○'}</span>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="closure-checklist__group closure-checklist__group--nonblocking">
        <h3>Terpisah · tidak memblokir</h3>
        <ul>
          {nonBlocking.map((item) => (
            <li className={item.complete ? 'closure-checklist__item is-complete' : 'closure-checklist__item'} key={item.key}>
              <span className="closure-checklist__mark" aria-hidden="true">{item.complete ? '✓' : '○'}</span>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
