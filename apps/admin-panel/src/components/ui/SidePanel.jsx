import { useEffect, useRef } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const SAFE = { paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }

/**
 * Panel de detalle. En 2xl se acomoda a la derecha de la tabla (columna del grid, sticky);
 * abajo de 2xl es un panel modal con fondo, foco atrapado y Esc que cierra y devuelve el foco (`returnFocus`).
 * `modal` lo deja siempre como panel modal (formulario de producto, 560 px).
 */
export default function SidePanel({ label, onClose, returnFocus, width = 'sm:w-[440px]', modal = false, children }) {
  const inline = useMediaQuery('(min-width: 1536px)') && !modal
  const ref = useRef(null)
  useLockBodyScroll(!inline)
  useFocusTrap(ref, { active: !inline, onEscape: onClose, returnFocus })

  // En modo columna (sin trampa de foco) Esc también cierra.
  useEffect(() => {
    if (!inline) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [inline, onClose])

  if (inline) {
    return (
      <aside
        ref={ref}
        aria-label={label}
        className="animate-slide bg-paper border border-line rounded-lg overflow-y-auto max-h-[calc(100vh-150px)] sticky top-[88px] min-w-0"
      >
        {children}
      </aside>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`animate-slide absolute inset-y-0 right-0 w-full ${width} bg-paper border-l border-line overflow-y-auto overscroll-contain`}
        style={SAFE}
      >
        {children}
      </aside>
    </div>
  )
}

/** Encabezado fijo del panel con botón de cerrar (primer elemento enfocable). */
export function SidePanelHeader({ children, onClose, closeLabel = 'Cerrar' }) {
  return (
    <div className="sticky top-0 bg-paper border-b border-line px-5 py-4 flex items-start justify-between gap-3 z-10">
      <div className="min-w-0">{children}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="w-11 h-11 -mr-2 -mt-1 rounded-md hover:bg-sand flex items-center justify-center shrink-0"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
