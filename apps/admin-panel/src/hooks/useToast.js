import { useContext } from 'react'
import { ToastContext } from '../context/toast-context'

/**
 * Avisos flotantes del panel (ToastProvider en App.jsx). `key`: un aviso nuevo con la misma clave reemplaza al anterior.
 * `action`: `{ label, onClick }` para un botón dentro del aviso ("Deshacer").
 * @returns {{ success: (text: string, options?: { key?: string, action?: { label: string, onClick: () => void } }) => number, error: (text: string, options?: { key?: string, action?: { label: string, onClick: () => void } }) => number, dismiss: (id: number) => void }}
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
