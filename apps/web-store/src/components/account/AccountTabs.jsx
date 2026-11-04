import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const TABS = [
  { to: '/cuenta/pedidos', label: 'Mis pedidos' },
  { to: '/cuenta/perfil', label: 'Mi perfil' },
  { to: '/cuenta/favoritos', label: 'Favoritos' },
]

// Mismo subrayado laca que el encabezado, sobre la línea de la barra, y texto más firme en la activa.
// NavLink pone aria-current="page" (también en el detalle de un pedido).
const TAB =
  'relative inline-flex min-h-11 items-center text-[12.5px] tracking-[.16em] whitespace-nowrap text-ink-soft uppercase transition-colors hover:text-ink aria-[current=page]:font-normal aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-laca'

/** Pestañas de las vistas con sesión: Mis pedidos · Mi perfil · Favoritos · Cerrar sesión. */
export default function AccountTabs() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const signOut = async () => {
    await logout()
    navigate('/cuenta', { replace: true })
  }

  return (
    <nav aria-label="Su cuenta" className="border-b border-ink/10">
      <ul className="flex gap-x-7 overflow-x-auto [scrollbar-width:none]">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink to={tab.to} className={TAB}>
              {tab.label}
            </NavLink>
          </li>
        ))}
        <li className="ml-auto">
          <button type="button" onClick={signOut} className={`${TAB} hover:text-laca`}>
            Cerrar sesión
          </button>
        </li>
      </ul>
    </nav>
  )
}
