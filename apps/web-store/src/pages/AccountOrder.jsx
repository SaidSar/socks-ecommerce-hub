import { Link, useParams } from 'react-router-dom'
import AccountLayout from '../components/account/AccountLayout'
import OrderDetail from '../components/account/OrderDetail'
import { useAsync } from '../hooks/useAsync'
import { getOrder } from '../services/orderService'

const BACK = 'inline-flex min-h-11 items-center text-[13px] text-ink-soft hover:text-ink'

/** Detalle de un pedido con sesión (/cuenta/pedidos/:folio): piezas, totales, dirección, seguimiento y envío. */
export default function AccountOrder() {
  const { folio } = useParams()
  const { status, data: order, retry } = useAsync(() => getOrder(folio), folio)

  return (
    <AccountLayout title={`Pedido ${folio}`} heading="Mis pedidos" description="Detalle y rastreo de su pedido en SOKKO.">
      <Link to="/cuenta/pedidos" className={`mb-4 ${BACK}`}>
        ← Todos mis pedidos
      </Link>

      {status === 'error' && (
        <div role="alert">
          <p className="font-serif text-[22px]">No pudimos cargar su pedido.</p>
          <button type="button" onClick={retry} className="mt-5 min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
            Reintentar
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div aria-busy="true" className="h-64 animate-pulse bg-sand">
          <span className="sr-only">Cargando su pedido…</span>
        </div>
      )}

      {status === 'ready' && !order && (
        <div>
          <h2 className="font-serif text-[26px] font-light">No encontramos este pedido en su cuenta.</h2>
          <p className="mt-2 text-[14px] text-ink-soft">
            Si compró como invitado, consúltelo en{' '}
            <Link to="/rastreo" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
              Rastrear pedido
            </Link>
            .
          </p>
        </div>
      )}

      {status === 'ready' && order && <OrderDetail order={order} />}
    </AccountLayout>
  )
}
