import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from '../brand/Icons'
import AuthField from './AuthField'

/**
 * Contraseña con botón de alternancia: etiqueta fija "Mostrar contraseña" y aria-pressed, así el lector anuncia
 * activado o desactivado. El ojo dibuja el estado: abierto si se ve el texto, tachado si está oculta.
 */
export default function PasswordField(props) {
  const [show, setShow] = useState(false)

  return (
    <AuthField
      {...props}
      type={show ? 'text' : 'password'}
      right={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label="Mostrar contraseña"
          aria-pressed={show}
          className="flex h-11 w-11 items-center justify-end text-ink-soft hover:text-ink"
        >
          {show ? <EyeIcon className="h-5 w-5" /> : <EyeOffIcon className="h-5 w-5" />}
        </button>
      }
    />
  )
}
