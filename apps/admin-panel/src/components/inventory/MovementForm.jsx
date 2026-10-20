import { useId, useRef, useState } from 'react'
import { MANUAL_MOVEMENTS, needsNote, validateMovement } from '../../domain/inventory'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

const PLACEHOLDER = {
  Entrada: 'Lote maquila noviembre',
  Merma: 'Hilo jalado, mancha…',
  Devolución: 'Cambio de talla, pedido SKK-…',
  'Conteo físico': 'Conteo de fin de mes',
}

/** Registrar movimiento (DESIGN_ADMIN.md §5.3). `onSubmit` llama a la API y devuelve el movimiento creado. */
export default function MovementForm({ row, onSubmit, onDone }) {
  const [type, setType] = useState('Entrada')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)
  const qtyRef = useRef(null)
  const typeRefs = useRef([])
  const ids = { qty: useId(), note: useId(), err: useId() }
  const isCount = type === 'Conteo físico'

  const pickType = (t) => {
    setType(t)
    setError('')
  }

  const onTypeKey = (e) => {
    const i = MANUAL_MOVEMENTS.indexOf(type)
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % MANUAL_MOVEMENTS.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + MANUAL_MOVEMENTS.length) % MANUAL_MOVEMENTS.length
    if (next === null) return
    e.preventDefault()
    pickType(MANUAL_MOVEMENTS[next])
    typeRefs.current[next]?.focus()
  }

  const submit = async (e) => {
    e.preventDefault()
    const err = validateMovement(row, { type, qty, note })
    if (err) {
      setError(err)
      qtyRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      await onSubmit({ type, qty, note })
      setDone(`${type} registrada`)
      setQty('')
      setNote('')
      setError('')
      onDone?.()
    } catch (ex) {
      setError(ex.message)
    } finally {
      setBusy(false)
    }
  }

  const diff = isCount && qty !== '' ? Number(qty) - row.stock : null

  return (
    <form onSubmit={submit} noValidate className="rounded-lg bg-linen border border-line p-4 space-y-3" aria-describedby={error ? ids.err : undefined}>
      <h3 className="text-[13.5px] font-medium">Registrar movimiento</h3>
      <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Tipo de movimiento" onKeyDown={onTypeKey}>
        {MANUAL_MOVEMENTS.map((t, i) => (
          <button
            type="button"
            key={t}
            ref={(el) => (typeRefs.current[i] = el)}
            role="radio"
            aria-checked={type === t}
            tabIndex={type === t ? 0 : -1}
            onClick={() => pickType(t)}
            className={`h-9 max-lg:h-11 rounded-md text-[12.5px] border ${type === t ? 'bg-ink text-linen border-ink' : 'bg-paper border-line hover:bg-sand'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={ids.qty} className="text-[12px] text-ink-soft">
          {isCount ? 'Pares contados en anaquel' : 'Cantidad de pares'}
        </label>
        <input
          ref={qtyRef}
          id={ids.qty}
          inputMode="numeric"
          autoComplete="off"
          value={qty}
          onChange={(e) => {
            setQty(e.target.value.replace(/\D/g, ''))
            setError('')
            setDone('')
          }}
          aria-invalid={Boolean(error)}
          className={`mt-1 h-10 max-lg:h-11 w-full rounded-md border bg-paper px-3 text-[14px] tnum outline-none focus:border-ai ${error ? 'border-laca' : 'border-line'}`}
        />
        {diff !== null && (
          <p className="text-[12px] text-ink-soft mt-1 tnum">
            Diferencia contra sistema: {diff > 0 ? '+' : ''}
            {diff} pares
          </p>
        )}
      </div>
      <div>
        <label htmlFor={ids.note} className="text-[12px] text-ink-soft">
          Motivo {needsNote(type) ? '' : '(opcional)'}
        </label>
        <input
          id={ids.note}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError('')
          }}
          placeholder={PLACEHOLDER[type]}
          className="mt-1 h-10 max-lg:h-11 w-full rounded-md border border-line bg-paper px-3 text-[13px] outline-none focus:border-ai placeholder:text-ink-soft"
        />
      </div>
      {error && (
        <p id={ids.err} className="text-[12.5px] text-laca" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="dark" disabled={busy}>
          <Icon name="check" className="w-4 h-4" />
          {busy ? 'Registrando…' : 'Registrar'}
        </Button>
        <span className="text-[12.5px] text-matcha" role="status">
          {done}
        </span>
      </div>
    </form>
  )
}
