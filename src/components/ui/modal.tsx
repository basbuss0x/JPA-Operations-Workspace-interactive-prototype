import { useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  footer?: ReactNode
  onClose: () => void
  restoreFocusRef?: { current: HTMLElement | null }
}

export function Modal({
  open,
  title,
  description,
  footer,
  onClose,
  restoreFocusRef,
  children,
}: PropsWithChildren<ModalProps>) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const restoreFocus = restoreFocusRef?.current ?? previousFocus
    const dialog = dialogRef.current
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]'
    const getFocusable = () => dialog ? [...dialog.querySelectorAll<HTMLElement>(focusableSelector)] : []
    const autoFocused = dialog?.querySelector<HTMLElement>('[data-autofocus], [autofocus]')
    const initialFocus = autoFocused ?? getFocusable()[0] ?? dialog
    initialFocus?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (restoreFocus?.isConnected) restoreFocus.focus()
    }
  }, [open, restoreFocusRef])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p id="modal-description">{description}</p> : null}
          </div>
          <button className="icon-button" aria-label="Tutup dialog" onClick={onClose}>×</button>
        </header>
        <div className="modal__content">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
