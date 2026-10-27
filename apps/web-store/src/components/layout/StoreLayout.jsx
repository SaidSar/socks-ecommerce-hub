import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import CartDrawer from '../cart/CartDrawer'
import Footer from './Footer'
import Header from './Header'

/** Marco común de la tienda: encabezado con las líneas, la vista de la ruta, pie y bolsa. */
export default function StoreLayout() {
  const { pathname } = useLocation()

  // Cada vista nueva empieza arriba (la búsqueda cambia ?q= sin cambiar de ruta y no se mueve).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
      <CartDrawer />
    </div>
  )
}
