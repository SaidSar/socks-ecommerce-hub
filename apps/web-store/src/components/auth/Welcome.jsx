import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { listMyOrders } from '../../services/orderService'

/**
 * Bienvenida (DESIGN_AUTH.md §4.5). `mode` llega en el state de la navegación desde login/registro;
 * si se entra desde "Mi carnet" no hay state y se usa el modo login. Al cerrar sesión, la guarda de
 * Account lleva a /cuenta.
 */
export default function Welcome({ mode = 'login' }) {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const headingRef = useRef(null)
  const isNew = mode === 'register'

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const { data: orders } = useAsync(listMyOrders, user.email)

  const stats = [
    [orders ? String(orders.length) : '—', 'pedidos'],
    [user.preferredSize || '—', 'talla guardada'],
    [String(count), count === 1 ? 'par en su bolsa' : 'pares en su bolsa'],
  ]

  return (
    <div className="animate-fade">
      <div className="relative h-24 w-24" aria-hidden="true">
        <span className="animate-stamp absolute inset-0 flex items-center justify-center border-2 border-laca bg-linen text-center font-jp text-[22px] leading-tight text-laca">
          {isNew ? '歓' : 'お'}
          <br />
          {isNew ? '迎' : '帰'}
        </span>
      </div>

      <p className="mt-8 text-[11px] tracking-[.32em] text-matcha uppercase">{isNew ? 'Cuenta creada' : 'Sesión iniciada'}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 font-serif text-[clamp(34px,4vw,48px)] leading-[1.05] font-light outline-none"
      >
        {isNew ? (
          <>
            Le damos la bienvenida,
            <br />
            <em className="text-laca italic">{user.firstName}</em>.
          </>
        ) : (
          <>
            Qué gusto verle de nuevo, <em className="text-laca italic">{user.firstName}</em>.
          </>
        )}
      </h1>

      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
        {isNew ? (
          <>
            Enviamos un correo a <span className="text-ink">{user.email}</span> para confirmar su cuenta.
            {user.preferredSize && (
              <>
                {' '}
                Guardamos su talla <span className="text-ink">{user.preferredSize}</span> para preseleccionarla en el
                atelier.
              </>
            )}
          </>
        ) : (
          'Su bolsa y sus pedidos están donde los dejó.'
        )}
      </p>

      <dl className="mt-8 grid max-w-md grid-cols-3 border-y border-ink/10">
        {stats.map(([value, label], i) => (
          <div key={label} className={`flex flex-col-reverse py-4 ${i ? 'border-l border-ink/10 pl-4' : ''}`}>
            <dt className="mt-1.5 text-[11.5px] text-ink-soft">{label}</dt>
            <dd className="tnum font-serif text-[26px] leading-none">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-9 flex flex-wrap items-center gap-6">
        <Link
          to="/"
          className="inline-flex h-[52px] items-center bg-laca px-9 text-[12px] tracking-[.28em] text-linen uppercase transition-colors hover:bg-laca-hover"
        >
          Volver al atelier
        </Link>
        <Link to="/cuenta/pedidos" className="inline-flex min-h-11 items-center font-serif text-[16px] italic underline decoration-ink/25 underline-offset-4 hover:text-ink">
          Mis pedidos
        </Link>
        <button
          type="button"
          onClick={logout}
          className="min-h-11 font-serif text-[16px] text-ink-soft italic underline decoration-ink/25 underline-offset-4 hover:text-ink"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
