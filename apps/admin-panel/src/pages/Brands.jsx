import { useId, useState } from 'react'
import { Banner, LineTag, Pill, TABLE, TD, TH } from '../components/catalog/CatalogUi'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'

/** Interruptor accesible (role="switch"). */
function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-55 ${checked ? 'bg-matcha' : 'bg-line'} after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform ${
        checked ? 'after:translate-x-4' : ''
      }`}
    />
  )
}

/** Fila para crear una marca: nombre con validación de duplicados (sin distinguir mayúsculas). */
function NewBrand({ onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ids = { input: useId(), err: useId() }
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onCreate(name)
    } catch (ex) {
      setError(ex.errors?.name ?? ex.message)
      setBusy(false)
    }
  }
  return (
    <Card as="form" onSubmit={submit} noValidate className="flex flex-wrap items-end gap-3 p-4">
      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <label htmlFor={ids.input} className="text-[12px] font-medium text-ink-soft">
          Nombre de la marca
        </label>
        <input
          id={ids.input}
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? ids.err : undefined}
          placeholder="Ej. Adidas"
          className={`h-10 rounded-md border bg-paper px-3 text-[13.5px] outline-none focus:border-ai ${error ? 'border-laca' : 'border-line'}`}
        />
        {error && (
          <p id={ids.err} role="alert" className="text-[12.5px] text-laca">
            {error}
          </p>
        )}
      </div>
      <Button variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={busy}>
        Crear marca
      </Button>
    </Card>
  )
}

/** Marcas (DESIGN_CATALOG_UI.md §4.4). Editar es solo del Dueño (`brands.edit`). */
export default function Brands() {
  const { can } = useAdminAuth()
  const { api } = useAdminData()
  const { data, error } = useAdminQuery(() => api.getCatalog(), [])
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('')
  const canEdit = can('brands.edit')

  const create = async (name) => {
    const brand = await api.addBrand(name)
    setAdding(false)
    setStatus(`Marca ${brand.name} creada.`)
  }
  const toggle = async (b) => {
    try {
      await api.setBrandVisibility(b.slug, !b.showInFilters, b.rowVersion)
      setStatus(`${b.name}: ${b.showInFilters ? 'oculta' : 'visible'} en el filtro de la tienda.`)
    } catch (ex) {
      setStatus(ex.message)
    }
  }

  return (
    <div className="max-w-[980px]">
      <PageHeader title="Marcas" sub="Las marcas visibles aparecen en el filtro de la tienda. SOKKO es la marca propia.">
        {canEdit && !adding && (
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" className="h-4 w-4" />
            Nueva marca
          </Button>
        )}
      </PageHeader>

      <div className="space-y-5">
        {!canEdit && <Banner>Solo el Dueño puede crear o editar marcas.</Banner>}
        {adding && <NewBrand onCreate={create} onCancel={() => setAdding(false)} />}
        <p role="status" className="text-[13px] text-matcha empty:hidden">
          {status}
        </p>

        {error && <EmptyState icon="alert" title="No pudimos cargar las marcas." />}
        {!data && !error && <Loading label="Cargando marcas…" />}
        {data && (
          <Card className="overflow-x-auto">
            <table className={`${TABLE} min-w-[620px]`}>
              <thead>
                <tr>
                  <th className={TH}>Marca</th>
                  <th className={TH}>Líneas donde se usa</th>
                  <th className={`${TH} text-right`}>Productos</th>
                  <th className={TH}>Mostrar en el filtro de la tienda</th>
                </tr>
              </thead>
              <tbody>
                {data.brands.map((b) => (
                  <tr key={b.slug} className="last:[&>td]:border-b-0">
                    <td className={TD}>
                      <span className="font-medium">{b.name}</span>
                      {b.isOwnBrand && (
                        <Pill tone="crit" className="ml-2">
                          Marca propia
                        </Pill>
                      )}
                    </td>
                    <td className={TD}>
                      <span className="flex flex-wrap gap-3">
                        {b.lines.length ? b.lines.map((l) => <LineTag key={l} line={l} />) : <span className="text-ink-soft">Sin productos</span>}
                      </span>
                    </td>
                    <td className={`${TD} tnum text-right`}>{b.products}</td>
                    <td className={TD}>
                      <span className="flex items-center gap-3">
                        <Switch
                          checked={b.showInFilters}
                          disabled={!canEdit || b.isOwnBrand}
                          onChange={() => toggle(b)}
                          label={`Mostrar ${b.name} en el filtro de la tienda`}
                        />
                        <span className="text-[12.5px] text-ink-soft">
                          {b.isOwnBrand ? 'Siempre visible' : b.showInFilters ? 'Visible' : 'Oculta'}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <p className="max-w-[80ch] text-[12px] text-ink-soft">
          Los productos con licencia usan como marca la licencia (Pokémon, Marvel). Los genéricos usan "Sin marca", que no aparece en el
          filtro. Una marca con productos no se borra: se oculta.
        </p>
      </div>
    </div>
  )
}
