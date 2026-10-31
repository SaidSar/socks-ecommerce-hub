import { useState } from 'react'
import { useAdminData, useAdminQuery } from '../../hooks/useAdminData'
import { Loading } from '../ui/EmptyState'
import SidePanel, { SidePanelHeader } from '../ui/SidePanel'
import Kardex from './Kardex'
import MovementForm from './MovementForm'

/** Panel de un SKU: resumen (stock, apartado, disponible), formulario de movimiento y kárdex. */
export default function StockPanel({ sku, canAdjust, onClose, returnFocus }) {
  const { api } = useAdminData()
  const { data: row } = useAdminQuery(() => api.getStockRow(sku), [sku])
  const { data: movements } = useAdminQuery(() => api.getMovements(sku), [sku])
  const [highlight, setHighlight] = useState(false)
  const current = row && row.sku === sku ? row : null

  return (
    <SidePanel label={`Inventario de ${sku}`} onClose={onClose} returnFocus={returnFocus} width="sm:w-[420px]">
      <SidePanelHeader onClose={onClose}>
        <p className="text-[12px] text-ink-soft tnum">{sku}</p>
        <h2 className="text-[17px] font-semibold">{current?.piece ?? 'Cargando…'}</h2>
        {current && (
          <p className="text-[12.5px] text-ink-soft">
            {current.toneName} · Talla {current.size}
          </p>
        )}
      </SidePanelHeader>
      {!current ? (
        <Loading />
      ) : (
        <div className="px-5 py-5 space-y-6">
          <dl className="grid grid-cols-3 rounded-lg border border-line divide-x divide-line text-center">
            {[
              ['Stock', current.stock],
              ['Apartado', current.reserved],
              ['Disponible', current.available],
            ].map(([k, v]) => (
              <div key={k} className="py-3">
                <dt className="text-[12px] text-ink-soft">{k}</dt>
                <dd className={`text-[22px] font-semibold tnum ${k === 'Disponible' && v <= 0 ? 'text-laca' : ''}`}>{v}</dd>
              </div>
            ))}
          </dl>

          {canAdjust && <MovementForm row={current} onSubmit={(mv) => api.adjustStock(sku, { ...mv, rowVersion: current.rowVersion })} onDone={() => setHighlight(true)} />}

          {movements ? <Kardex movements={movements} highlight={highlight} /> : <Loading label="Cargando kárdex…" />}
        </div>
      )}
    </SidePanel>
  )
}
