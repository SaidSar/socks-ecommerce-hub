import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ProtectedLayout, RequirePermission } from './components/layout/Guards'
import { NAV } from './config/navigation'
import { AdminAuthProvider } from './context/AdminAuthContext'
import Brands from './pages/Brands'
import Collections from './pages/Collections'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Orders from './pages/Orders'
import Products from './pages/Products'
import ProductTypes from './pages/ProductTypes'
import Settings from './pages/Settings'
import Shipments from './pages/Shipments'

const guard = (section, element) => <RequirePermission section={section}>{element}</RequirePermission>

const soonRoutes = NAV.filter((n) => !n.ready).map((n) => ({
  path: n.to.slice(1),
  element: guard(n.key, <ComingSoon section={n.key} />),
}))

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'pedidos', element: guard('pedidos', <Orders />) },
      { path: 'pedidos/:folio', element: guard('pedidos', <Orders />) },
      { path: 'inventario', element: guard('inventario', <Inventory />) },
      { path: 'envios', element: guard('envios', <Shipments />) },
      { path: 'catalogo/productos', element: guard('productos', <Products />) },
      { path: 'catalogo/marcas', element: guard('marcas', <Brands />) },
      { path: 'catalogo/colecciones', element: guard('colecciones', <Collections />) },
      { path: 'catalogo/tipos', element: guard('tipos', <ProductTypes />) },
      { path: 'configuracion', element: guard('configuracion', <Settings />) },
      ...soonRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <AdminAuthProvider>
      <RouterProvider router={router} />
    </AdminAuthProvider>
  )
}
