import { BrowserRouter, Route, Routes } from 'react-router-dom'
import StoreLayout from './components/layout/StoreLayout'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ConfigProvider } from './context/ConfigContext'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import Account from './pages/Account'
import Home from './pages/Home'
import LinePage from './pages/LinePage'
import NotFound from './pages/NotFound'
import ProductPage from './pages/ProductPage'
import SearchPage from './pages/SearchPage'

function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              {/* Tienda (DESIGN_CATALOG_UI.md §3.1): encabezado con las cuatro líneas, pie y bolsa. */}
              <Route element={<StoreLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/linea/:line" element={<LinePage />} />
                <Route path="/buscar" element={<SearchPage />} />
                <Route path="/producto/:slug" element={<ProductPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/confirmacion/:folio" element={<OrderConfirmation />} />
              <Route path="/cuenta" element={<Account view="login" />} />
              <Route path="/cuenta/registro" element={<Account view="register" />} />
              <Route path="/cuenta/recuperar" element={<Account view="forgot" />} />
              <Route path="/cuenta/restablecer" element={<Account view="reset" />} />
              <Route path="/cuenta/bienvenida" element={<Account view="welcome" />} />
              <Route path="/cuenta/pedidos" element={<Account view="orders" />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
