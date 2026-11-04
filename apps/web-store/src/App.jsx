import { BrowserRouter, Route, Routes } from 'react-router-dom'
import RequireAuth from './components/account/RequireAuth'
import StoreLayout from './components/layout/StoreLayout'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ConfigProvider } from './context/ConfigContext'
import { WishlistProvider } from './context/WishlistContext'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import About from './pages/About'
import Account from './pages/Account'
import AccountOrder from './pages/AccountOrder'
import AccountOrders from './pages/AccountOrders'
import Contact from './pages/Contact'
import Faq from './pages/Faq'
import Favorites from './pages/Favorites'
import Home from './pages/Home'
import LegalPage from './pages/LegalPage'
import LinePage from './pages/LinePage'
import NotFound from './pages/NotFound'
import ProductPage from './pages/ProductPage'
import Profile from './pages/Profile'
import SearchPage from './pages/SearchPage'
import Shipping from './pages/Shipping'
import TrackOrder from './pages/TrackOrder'
import { PRIVACY, RETURNS, TERMS } from './content/legal'

function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                {/* Tienda (DESIGN_CATALOG_UI.md §3.1): encabezado con las cuatro líneas, pie y bolsa. */}
                <Route element={<StoreLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/linea/:line" element={<LinePage />} />
                  <Route path="/buscar" element={<SearchPage />} />
                  <Route path="/producto/:slug" element={<ProductPage />} />
                  <Route path="/nosotros" element={<About />} />
                  <Route path="/contacto" element={<Contact />} />
                  <Route path="/preguntas-frecuentes" element={<Faq />} />
                  <Route path="/envios" element={<Shipping />} />
                  <Route path="/privacidad" element={<LegalPage doc={PRIVACY} />} />
                  <Route path="/terminos" element={<LegalPage doc={TERMS} />} />
                  <Route path="/devoluciones" element={<LegalPage doc={RETURNS} />} />
                  <Route path="/rastreo" element={<TrackOrder />} />
                  {/* Cuenta con sesión, dentro de la tienda y con pestañas. Favoritos también funciona sin sesión. */}
                  <Route path="/cuenta/pedidos" element={<RequireAuth><AccountOrders /></RequireAuth>} />
                  <Route path="/cuenta/pedidos/:folio" element={<RequireAuth><AccountOrder /></RequireAuth>} />
                  <Route path="/cuenta/perfil" element={<RequireAuth><Profile /></RequireAuth>} />
                  <Route path="/cuenta/favoritos" element={<Favorites />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/checkout/confirmacion/:folio" element={<OrderConfirmation />} />
                <Route path="/cuenta" element={<Account view="login" />} />
                <Route path="/cuenta/registro" element={<Account view="register" />} />
                <Route path="/cuenta/recuperar" element={<Account view="forgot" />} />
                <Route path="/cuenta/restablecer" element={<Account view="reset" />} />
                <Route path="/cuenta/bienvenida" element={<Account view="welcome" />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
