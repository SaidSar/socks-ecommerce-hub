import { useId } from 'react'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'

/** Correo de la tienda que recibe los mensajes de /contacto. Vacío: los mensajes solo se guardan. */
export default function ContactSettings({ value, onChange, error }) {
  const id = useId()
  const hintId = useId()
  const errId = useId()
  return (
    <Card aria-labelledby="contactcfg-title">
      <CardHead id="contactcfg-title" title="Contacto" />
      <div className="px-5 pb-5 max-w-md">
        <label htmlFor={id} className="text-[12.5px] text-ink-soft">
          Correo de la tienda
        </label>
        <div data-field-wrap className={`mt-1 flex items-center h-10 max-lg:h-11 rounded-md border bg-paper focus-within:border-ai ${error ? 'border-laca' : 'border-line'}`}>
          <input
            id={id}
            data-in-wrap
            type="email"
            autoComplete="off"
            placeholder="hola@sokko.mx"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${errId} ${hintId}` : hintId}
            className="w-full min-w-0 bg-transparent px-3 text-[14px] outline-none"
          />
        </div>
        {error && (
          <p id={errId} className="text-[12px] text-laca mt-1">
            {error}
          </p>
        )}
        <p id={hintId} className="text-[12px] text-ink-soft mt-1">
          Aquí llegan los mensajes del formulario de contacto. Si lo deja vacío, los mensajes solo se guardan.
        </p>
      </div>
    </Card>
  )
}
