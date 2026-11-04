import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/ui/Icon'
import { dropToast, pushToast, TOAST_MS } from '../domain/toasts'
import { ToastContext } from './toast-context'

/** Un aviso. Se cierra solo a los 4 s; el tiempo se detiene mientras el puntero o el foco están encima. */
function Toast({ toast, onClose }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(TOAST_MS)

  useEffect(() => {
    if (paused) return
    const started = Date.now()
    const timer = setTimeout(onClose, remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - started
    }
  }, [paused, onClose])

  const error = toast.tone === 'error'

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      className={`animate-fade pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line border-l-4 bg-paper py-1 pr-1 pl-3 shadow-lg ${
        error ? 'border-l-laca' : 'border-l-matcha'
      }`}
    >
      <span className={`mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${error ? 'bg-crit-bg text-laca' : 'bg-ok-bg text-matcha'}`}>
        <Icon name={error ? 'alert' : 'check'} className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 py-3 text-[13.5px] leading-snug text-ink">{toast.text}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.onClick()
            onClose()
          }}
          className="h-11 shrink-0 rounded-md px-3 text-[13px] font-medium text-ai hover:bg-sand"
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-sand hover:text-ink">
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Avisos flotantes del panel: arriba a la derecha en escritorio y abajo al centro en celular.
 * La región `role="status"` siempre está montada para que el lector de pantalla anuncie cada aviso nuevo.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((list) => dropToast(list, id)), [])

  const show = useCallback((tone, text, { key, action } = {}) => {
    const id = nextId.current++
    setToasts((list) => pushToast(list, { id, tone, text, key, action }))
    return id
  }, [])

  const value = useMemo(
    () => ({ dismiss, success: (text, options) => show('success', text, options), error: (text, options) => show('error', text, options) }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:top-4 lg:right-6 lg:bottom-auto lg:items-end lg:px-0"
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
