import { useId, useRef } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll'
import Icon from './Icon'

/** Diálogo modal centrado: fondo, foco atrapado, Esc cierra y devuelve el foco al disparador. */
export default function Modal({ title, sub, onClose, children, size = 'max-w-2xl', role = 'dialog' }) {
  const ref = useRef(null)
  const titleId = useId()
  useLockBodyScroll(true)
  useFocusTrap(ref, { onEscape: onClose })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center gutter py-6" role={role} aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className={`relative w-full ${size} max-h-full overflow-y-auto overscroll-contain bg-paper rounded-lg border border-line shadow-xl animate-fade`}>
        <div className="sticky top-0 bg-paper border-b border-line px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold">
              {title}
            </h2>
            {sub && <p className="text-[12.5px] text-ink-soft mt-0.5">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-11 h-11 -mr-2 -mt-1 rounded-md hover:bg-sand flex items-center justify-center shrink-0">
            <Icon name="x" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
