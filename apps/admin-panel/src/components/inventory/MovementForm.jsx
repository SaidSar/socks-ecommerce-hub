import { useId, useRef, useState } from 'react'
import { countNoun, label, MOVEMENT_LABELS } from '../../domain/enums'
import { checkMovement, MANUAL_MOVEMENTS, needsFolio, needsNote } from '../../domain/inventory'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

const PLACEHOLDER = {
  entrada: 'Lote maquila noviembre',
  merma: 'Hilo jalado, mancha…',
  devolucion: 'Cambio de talla',
  conteo_fisico: 'Conteo de fin de mes',
}

/**
 * Registrar movimiento (DESIGN_ADMIN.md §5.3). `onSubmit` llama a la API y devuelve el movimiento creado.
 * La Devolución exige el folio de su pedido (DESIGN_DB.md §3.7); que exista lo comprueba la API.
 */
export default function MovementForm({ row, onSubmit, onDone }) {
  const [type, setType] = useState('entrada')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [folio, setFolio] = useState('')
  // `field` dice junto a qué campo va el error: 'folio' se muestra en línea; el resto, al pie.
  const [error, setError] = useState({ message: '', field: '' })
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)
  const qtyRef = useRef(null)
  const noteRef = useRef(null)
  const folioRef = useRef(null)
  const typeRefs = useRef([])
  const ids = { qty: useId(), note: useId(), folio: useId(), folioHint: useId(), folioErr: useId(), err: useId() }
  const isCount = type === 'conteo_fisico'
  const withFolio = needsFolio(type)
  const folioError = error.field === 'folio' ? error.message : ''
  const formError = error.field === 'folio' ? '' : error.message
  const clearError = () => setError({ message: '', field: '' })

  const pickType = (t) => {
    setType(t)
    clearError()
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

  const focusField = (field) => ({ folio: folioRef, note: noteRef }[field] ?? qtyRef).current?.focus()

  const submit = async (e) => {
    e.preventDefault()
    const check = checkMovement(row, { type, qty, note, folio })
    if (check.message) {
      setError(check)
      focusField(check.field)
      return
    }
    setBusy(true)
    try {
      await onSubmit({ type, qty, note, folio: withFolio ? folio : undefined })
      setDone(`${label(MOVEMENT_LABELS, type)} registrada`)
      setQty('')
      setNote('')
      setFolio('')
      clearError()
      onDone?.()
    } catch (ex) {
      setError({ message: ex.message, field: ex.field ?? '' })
      if (ex.field) focusField(ex.field)
    } finally {
      setBusy(false)
    }
  }

  const diff = isCount && qty !== '' ? Number(qty) - row.stock : null
  const pairs = row.unit === 'par'

  return (
    <form onSubmit={submit} noValidate className="rounded-lg bg-linen border border-line p-4 space-y-3" aria-describedby={formError ? ids.err : undefined}>
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
            {label(MOVEMENT_LABELS, t)}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={ids.qty} className="text-[12px] text-ink-soft">
          {isCount ? (pairs ? 'Pares contados en anaquel' : 'Unidades contadas en anaquel') : pairs ? 'Cantidad de pares' : 'Cantidad de unidades'}
        </label>
        <input
          ref={qtyRef}
          id={ids.qty}
          inputMode="numeric"
          autoComplete="off"
          value={qty}
          onChange={(e) => {
            setQty(e.target.value.replace(/\D/g, ''))
            clearError()
            setDone('')
          }}
          aria-invalid={error.field === 'qty'}
          className={`mt-1 h-10 max-lg:h-11 w-full rounded-md border bg-paper px-3 text-[14px] tnum outline-none focus:border-ai ${error.field === 'qty' ? 'border-laca' : 'border-line'}`}
        />
        {diff !== null && (
          <p className="text-[12px] text-ink-soft mt-1 tnum">
            Diferencia contra sistema: {diff > 0 ? '+' : ''}
            {diff} {countNoun(Math.abs(diff), row.unit)}
          </p>
        )}
      </div>
      {withFolio && (
        <div>
          <label htmlFor={ids.folio} className="text-[12px] text-ink-soft">
            Folio del pedido
          </label>
          <input
            ref={folioRef}
            id={ids.folio}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={folio}
            onChange={(e) => {
              setFolio(e.target.value.toUpperCase())
              clearError()
              setDone('')
            }}
            placeholder="SKK-1042"
            aria-invalid={Boolean(folioError)}
            aria-describedby={folioError ? `${ids.folioErr} ${ids.folioHint}` : ids.folioHint}
            className={`mt-1 h-10 max-lg:h-11 w-full rounded-md border bg-paper px-3 text-[14px] tnum outline-none focus:border-ai placeholder:text-ink-soft ${folioError ? 'border-laca' : 'border-line'}`}
          />
          <p id={ids.folioHint} className="text-[12px] text-ink-soft mt-1">
            {pairs ? 'Pedido del que regresan los pares.' : 'Pedido del que regresan las unidades.'}
          </p>
          {folioError && (
            <p id={ids.folioErr} className="text-[12.5px] text-laca mt-1" role="alert">
              {folioError}
            </p>
          )}
        </div>
      )}
      <div>
        <label htmlFor={ids.note} className="text-[12px] text-ink-soft">
          Motivo {needsNote(type) ? '' : '(opcional)'}
        </label>
        <input
          ref={noteRef}
          id={ids.note}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            clearError()
          }}
          placeholder={PLACEHOLDER[type]}
          aria-invalid={error.field === 'note'}
          className={`mt-1 h-10 max-lg:h-11 w-full rounded-md border bg-paper px-3 text-[13px] outline-none focus:border-ai placeholder:text-ink-soft ${error.field === 'note' ? 'border-laca' : 'border-line'}`}
        />
      </div>
      {formError && (
        <p id={ids.err} className="text-[12.5px] text-laca" role="alert">
          {formError}
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
