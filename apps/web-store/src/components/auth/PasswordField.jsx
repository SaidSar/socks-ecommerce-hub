import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from '../brand/Icons'
import AuthField from './AuthField'

/** Contraseña con botón mostrar/ocultar (aria-pressed). */
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
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={show}
          className="flex h-11 w-11 items-center justify-end text-ink-soft hover:text-ink"
        >
          {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      }
    />
  )
}
