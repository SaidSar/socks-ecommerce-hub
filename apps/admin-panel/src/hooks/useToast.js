import { useContext } from 'react'
import { ToastContext } from '../context/toast-context'

/**
 * Avisos flotantes del panel (ToastProvider en App.jsx). `key`: un aviso nuevo con la misma clave reemplaza al anterior.
 * @returns {{ success: (text: string, options?: { key?: string }) => number, error: (text: string, options?: { key?: string }) => number, dismiss: (id: number) => void }}
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
