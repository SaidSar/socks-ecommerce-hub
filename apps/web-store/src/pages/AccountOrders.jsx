import AccountLayout from '../components/account/AccountLayout'
import MyOrders from '../components/auth/MyOrders'

/** Mis pedidos (/cuenta/pedidos). La guarda de sesión va en la ruta. */
export default function AccountOrders() {
  return (
    <AccountLayout title="Mis pedidos" description="Sus pedidos en SOKKO: estado, piezas y envío.">
      <div className="max-w-3xl">
        <MyOrders />
      </div>
    </AccountLayout>
  )
}
