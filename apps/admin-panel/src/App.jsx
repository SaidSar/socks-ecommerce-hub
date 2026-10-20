import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { NAV } from './config/navigation'
import { AdminDataProvider } from './context/AdminDataContext'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Orders from './pages/Orders'
import Settings from './pages/Settings'

// TODO(api): el usuario llega de la sesión (Fase 3).
const PLACEHOLDER_USER = { name: 'Aiko Morales', email: 'hola@sokko.mx', role: 'dueno' }

const soonRoutes = NAV.filter((n) => !n.ready).map((n) => ({
  path: n.to.slice(1),
  element: <ComingSoon section={n.key} />,
}))

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'pedidos', element: <Orders /> },
      { path: 'pedidos/:folio', element: <Orders /> },
      { path: 'inventario', element: <Inventory /> },
      { path: 'configuracion', element: <Settings /> },
      ...soonRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <AdminDataProvider user={PLACEHOLDER_USER}>
      <RouterProvider router={router} />
    </AdminDataProvider>
  )
}
