import { useContext } from 'react'
import { ToastContext } from '../context/toast-context'

// Sin provider (pruebas de un componente suelto) los avisos no se muestran y nada falla.
const SILENT = { show: () => null, success: () => null, error: () => null, dismiss: () => {} }

/**
 * Avisos flotantes de la tienda (ToastProvider).
 * `action`: `{ label, to }` (enlace) o `{ label, onClick }` (botón). `key`: un aviso nuevo con la misma clave reemplaza al anterior.
 * @returns {{
 *   show: (toast: { tone?: 'success' | 'error', text: string, action?: object, key?: string }) => number,
 *   success: (text: string, options?: object) => number, error: (text: string, options?: object) => number,
 *   dismiss: (id: number) => void,
 * }}
 */
export function useToast() {
  return useContext(ToastContext) ?? SILENT
}
