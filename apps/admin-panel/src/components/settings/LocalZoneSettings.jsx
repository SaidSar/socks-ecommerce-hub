import { useState } from 'react'
import { formatZone, validateZone } from '../../domain/shipping'
import Button from '../ui/Button'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import Icon from '../ui/Icon'

/** Códigos postales y rangos con tarifa local. */
export default function LocalZoneSettings({ zones, onChange, error }) {
  const [zip, setZip] = useState('')
  const [zipErr, setZipErr] = useState('')

  const add = () => {
    const v = zip.trim()
    const err = validateZone(v)
    if (err) return setZipErr(err)
    const value = formatZone(v)
    if (zones.some((z) => formatZone(z.value) === value)) return setZipErr('Ese código postal ya está en la zona.')
    onChange([...zones, { value, label: 'Agregado' }])
    setZip('')
    setZipErr('')
  }

  return (
    <Card aria-labelledby="zone-title">
      <CardHead id="zone-title" title="Zona de entrega local" sub="Códigos postales de Los Mochis y ejidos vecinos con tarifa local" />
      <div className="px-5 pb-5">
        <ul className="flex flex-wrap gap-2" aria-label="Códigos postales en la zona local">
          {zones.map((z, i) => (
            <li key={`${z.value}-${i}`} className="inline-flex items-center gap-2 rounded-full bg-sand pl-3 pr-1 py-1 text-[12.5px]">
              <span className="tnum font-medium">{z.value}</span>
              {z.label && <span className="text-ink-soft">{z.label}</span>}
              <button
                type="button"
                onClick={() => onChange(zones.filter((_, k) => k !== i))}
                aria-label={`Quitar ${z.value}`}
                className="w-6 h-6 max-lg:w-9 max-lg:h-9 rounded-full hover:bg-sand-2 flex items-center justify-center"
              >
                <Icon name="x" className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {!zones.length && <li className="text-[12.5px] text-ink-soft">Sin códigos postales.</li>}
        </ul>
        <div className="mt-3 flex gap-2">
          <label htmlFor="cfg-zip" className="sr-only">
            Código postal o rango
          </label>
          <input
            id="cfg-zip"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value)
              setZipErr('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="CP o rango, ej. 81280–81290"
            aria-invalid={Boolean(zipErr)}
            aria-describedby={zipErr ? 'cfg-zip-err' : undefined}
            className={`h-10 max-lg:h-11 flex-1 min-w-0 rounded-md border bg-paper px-3 text-[13px] tnum outline-none focus:border-ai placeholder:text-ink-soft ${zipErr ? 'border-laca' : 'border-line'}`}
          />
          <Button variant="outline" onClick={add}>
            <Icon name="plus" className="w-4 h-4" />
            Agregar
          </Button>
        </div>
        {(zipErr || error) && (
          <p id="cfg-zip-err" className="text-[12.5px] text-laca mt-1.5" role="alert">
            {zipErr || error}
          </p>
        )}
        <p className="text-[12px] text-ink-soft mt-2">Confirme con el cliente los códigos postales exactos de los ejidos vecinos.</p>
      </div>
    </Card>
  )
}
