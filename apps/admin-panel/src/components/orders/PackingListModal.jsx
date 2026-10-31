import { CARRIER_LABELS, countText, label } from '../../domain/enums'
import { orderUnit } from '../../domain/orders'
import { useAdminData, useAdminQuery } from '../../hooks/useAdminData'
import { formatDate, formatTime } from '../../utils/format'
import Button from '../ui/Button'
import EmptyState, { Loading } from '../ui/EmptyState'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

/** Lista de empaque para imprimir (GET /api/admin/orders/{folio}/packing-list). Nunca lleva importes. */
export default function PackingListModal({ order, onClose }) {
  const { api } = useAdminData()
  const { data: list, error } = useAdminQuery(() => api.getPackingList(order.id), [order.id])

  return (
    <Modal title={`Lista de empaque · ${order.id}`} onClose={onClose}>
      {error && <EmptyState icon="alert" title="No pudimos cargar la lista de empaque." />}
      {!list && !error && <Loading label="Cargando lista de empaque…" />}
      {list && (
        <div className="print-area space-y-4">
          <div className="text-[13px]">
            <p className="text-[12px] text-ink-soft">
              Pedido {list.folio} · {formatDate(list.created)}, {formatTime(list.created)}
            </p>
            <p className="font-medium mt-2">{list.customerName}</p>
            <p>
              {list.street}, {list.neighborhood}
            </p>
            <p>
              {list.city}, {list.state} · CP {list.postalCode}
            </p>
            <p>Tel. {list.phone}</p>
            {list.references && <p className="text-ink-soft">Referencias: {list.references}</p>}
            <p className="mt-2">
              {list.delivery === 'local'
                ? `Entrega local${order.courier ? ` · ${order.courier}` : ''}`
                : `Paquetería${order.carrier ? ` · ${label(CARRIER_LABELS, order.carrier)}` : ''}${order.tracking ? ` · guía ${order.tracking}` : ''}`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[420px]">
              <caption className="sr-only">Piezas por empacar</caption>
              <thead className="text-left text-ink-soft text-[12px] border-b border-line">
                <tr>
                  <th scope="col" className="py-2 font-medium">
                    SKU
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Pieza
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Tono
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Talla
                  </th>
                  <th scope="col" className="py-2 font-medium text-right">
                    Cant.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.items.map((it) => (
                  <tr key={it.sku}>
                    <td className="py-2 tnum whitespace-nowrap">{it.sku}</td>
                    <td className="py-2">{it.name}</td>
                    <td className="py-2">{it.toneName}</td>
                    <td className="py-2">{it.size}</td>
                    <td className="py-2 tnum text-right font-medium">{it.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] font-medium">Total: {countText(list.units, orderUnit(list))}</p>
          {list.giftWrap && (
            <p className="text-[13px] flex items-center gap-2">
              <Icon name="check" className="w-4 h-4" />
              Envolver en furoshiki
            </p>
          )}
          {list.note && <p className="text-[13px]">Nota: {list.note}</p>}
          <div className="no-print flex flex-wrap gap-2 pt-1">
            <Button onClick={() => window.print()}>
              <Icon name="box" className="w-4 h-4" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
