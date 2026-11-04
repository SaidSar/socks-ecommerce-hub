import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircleIcon, CheckCircleIcon, CloseIcon } from '../components/brand/Icons'
import { TOAST_MS, ToastContext } from './toast-context'

const MAX_VISIBLE = 3

const ACTION = 'inline-flex min-h-11 items-center text-[13px] text-ink underline decoration-laca underline-offset-4 hover:text-laca'

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
  const Icon = error ? AlertCircleIcon : CheckCircleIcon
  const { action } = toast

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      className={`animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 border border-l-2 border-ink/10 bg-linen py-1 pr-1 pl-4 shadow-[0_12px_32px_-14px_rgba(35,33,30,.45)] ${
        error ? 'border-l-laca' : 'border-l-matcha'
      }`}
    >
      <Icon className={`mt-3 h-5 w-5 shrink-0 ${error ? 'text-laca' : 'text-matcha'}`} />
      <div className="min-w-0 flex-1 py-2.5">
        <p className="text-[14px] leading-snug text-ink">{toast.text}</p>
        {action &&
          (action.to ? (
            <Link to={action.to} onClick={onClose} className={`${ACTION} -mb-2.5`}>
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                action.onClick()
                onClose()
              }}
              className={`${ACTION} -mb-2.5`}
            >
              {action.label}
            </button>
          ))}
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-soft hover:text-ink">
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Avisos flotantes de la tienda: arriba a la derecha en escritorio y abajo al centro en celular.
 * La región `role="status"` siempre está montada para que el lector de pantalla anuncie cada aviso nuevo.
 * Va dentro del router: las acciones pueden ser enlaces.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(({ tone = 'success', text, action, key }) => {
    const id = nextId.current++
    setToasts((list) => [...list.filter((t) => !key || t.key !== key), { id, tone, text, action, key }].slice(-MAX_VISIBLE))
    return id
  }, [])

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (text, options) => show({ ...options, text, tone: 'success' }),
      error: (text, options) => show({ ...options, text, tone: 'error' }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:top-[84px] md:right-6 md:bottom-auto md:items-end md:px-0"
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
