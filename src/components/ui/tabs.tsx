import { useEffect, useRef } from 'react'

interface TabItem<T extends string> {
  id: T
  label: string
}

interface TabsProps<T extends string> {
  items: Array<TabItem<T>>
  active: T
  onChange: (id: T) => void
  label: string
}

export function Tabs<T extends string>({ items, active, onChange, label }: TabsProps<T>) {
  const activeTabRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
  }, [active])

  return (
    <>
      <div className="tabs" role="tablist" aria-label={label}>
        {items.map((item) => (
          <button
            key={item.id}
            ref={(node) => {
              if (item.id === active) activeTabRef.current = node
            }}
            className={item.id === active ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="tabs__mobile-picker">
        <span>Bagian aktif</span>
        <select aria-label={label} value={active} onChange={(event) => onChange(event.target.value as T)}>
          {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
    </>
  )
}
