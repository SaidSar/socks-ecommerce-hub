import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ConfigProvider } from './context/ConfigContext'
import Account from './pages/Account'
import Home from './pages/Home'

function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/cuenta" element={<Account view="login" />} />
              <Route path="/cuenta/registro" element={<Account view="register" />} />
              <Route path="/cuenta/recuperar" element={<Account view="forgot" />} />
              <Route path="/cuenta/bienvenida" element={<Account view="welcome" />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
