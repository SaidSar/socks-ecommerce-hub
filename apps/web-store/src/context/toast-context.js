import { createContext } from 'react'

// Objeto de contexto separado del provider para que Fast Refresh funcione (react/only-export-components).
export const ToastContext = createContext(null)

/** Tiempo que un aviso queda a la vista. */
export const TOAST_MS = 4000
