import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom'
import { ProtectedLayout, RequirePermission } from './components/layout/Guards'
import { NAV } from './config/navigation'
import { AdminAuthProvider } from './context/AdminAuthContext'
import { ToastProvider } from './context/ToastContext'
import Card from './components/ui/Card'
import { SkeletonRows } from './components/ui/Skeleton'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

// Login y Dashboard van en el bundle inicial; cada sección se descarga al abrirla (el bundle pasaba de 500 kB).
const Brands = lazy(() => import('./pages/Brands'))
const Collections = lazy(() => import('./pages/Collections'))
const Customers = lazy(() => import('./pages/Customers'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Messages = lazy(() => import('./pages/Messages'))
const Orders = lazy(() => import('./pages/Orders'))
const Products = lazy(() => import('./pages/Products'))
const ProductTypes = lazy(() => import('./pages/ProductTypes'))
const Promotions = lazy(() => import('./pages/Promotions'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Shipments = lazy(() => import('./pages/Shipments'))

/** Mientras llega el código de la sección: el mismo esqueleto que muestran las pantallas al cargar datos. */
function SectionLoading() {
  return (
    <Card>
      <SkeletonRows label="Cargando sección…" rows={5} />
    </Card>
  )
}

const guard = (section, element) => (
  <RequirePermission section={section}>
    <Suspense fallback={<SectionLoading />}>{element}</Suspense>
  </RequirePermission>
)

/** La sección se llamaba Finanzas: los enlaces viejos llegan a Reportes con el mismo periodo. */
function ToReports() {
  const { search } = useLocation()
  return <Navigate to={`/reportes${search}`} replace />
}

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
      { path: 'clientes', element: guard('clientes', <Customers />) },
      { path: 'reportes', element: guard('finanzas', <Reports />) },
      { path: 'finanzas', element: <ToReports /> },
      { path: 'mensajes', element: guard('mensajes', <Messages />) },
      { path: 'promociones', element: guard('promociones', <Promotions />) },
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
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AdminAuthProvider>
  )
}
