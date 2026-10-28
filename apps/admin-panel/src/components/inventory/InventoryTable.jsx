import Button from '../ui/Button'
import Card from '../ui/Card'
import StockChip from '../ui/StockChip'

/** Stock por SKU. El botón "Ajustar · kárdex" solo aparece con `canAdjust`. */
export default function InventoryTable({ rows, selected, canAdjust, few, onSelect }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="relative overflow-x-auto">
        <table className="w-full text-[13px] min-w-[820px]">
          <caption className="sr-only">Inventario por SKU</caption>
          <thead className="bg-linen text-ink-soft text-[12px]">
            <tr className="text-left">
              <th scope="col" className="px-5 py-2.5 font-medium">
                Pieza
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Tono
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Talla
              </th>
              <th scope="col" className="py-2.5 font-medium">
                SKU
              </th>
              <th scope="col" className="py-2.5 font-medium text-right">
                Stock
              </th>
              <th scope="col" className="py-2.5 font-medium text-right">
                Apartado
              </th>
              <th scope="col" className="py-2.5 font-medium text-right">
                Disponible
              </th>
              <th scope="col" className="py-2.5 pl-4 font-medium">
                Estado
              </th>
              {canAdjust && (
                <th scope="col" className="px-5 py-2.5">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.sku} className={selected === r.sku ? 'bg-info-bg/60' : 'hover:bg-linen'}>
                <td className="px-5 py-2.5">
                  {r.piece}
                  {r.edition && <span className="ml-1.5 text-[11px] text-ink-soft">ed. {r.edition}</span>}
                </td>
                <td className="py-2.5">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span className="w-3 h-3 rounded-full border border-line" style={{ background: r.toneHex }} aria-hidden="true" />
                    {r.toneName}
                  </span>
                </td>
                <td className="py-2.5">{r.size}</td>
                <td className="py-2.5 tnum text-ink-soft whitespace-nowrap">{r.sku}</td>
                <td className="py-2.5 text-right tnum">{r.stock}</td>
                <td className="py-2.5 text-right tnum text-ink-soft">{r.reserved}</td>
                <td className={`py-2.5 text-right tnum font-semibold ${r.available <= 0 ? 'text-laca' : ''}`}>{r.available}</td>
                <td className="py-2.5 pl-4">
                  <StockChip state={r.state} />
                </td>
                {canAdjust && (
                  <td className="px-5 py-2.5 text-right">
                    <Button variant="outline" size="sm" data-sku={r.sku} onClick={() => onSelect(r.sku)} aria-label={`Ajustar y ver kárdex de ${r.sku}`}>
                      Ajustar · kárdex
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="px-5 py-14 text-center text-ink-soft">Ningún SKU coincide. Borre la búsqueda o elija “Todos”.</p>}
      </div>
      <p className="px-5 py-3 text-[12px] text-ink-soft border-t border-line">
        Disponible = stock − apartado por pedidos sin enviar. Alerta con {few} unidades o menos.
      </p>
    </Card>
  )
}
