import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthField, { AuthAlert, AuthSubmit } from '../components/auth/AuthField'
import CheckoutLayout, { EYEBROW, TotalsRow } from '../components/checkout/CheckoutLayout'
import ProductArt from '../components/product/ProductArt'
import { CHECKOUT_MESSAGES, deliveryLabel, digitsOnly, taxIncluded, validateCheckout } from '../domain/checkout'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { useConfig } from '../hooks/useConfig'
import { useShake } from '../hooks/useShake'
import { OrderError, placeOrder, quoteShipping } from '../services/orderService'
import { tokenizeCard } from '../services/paymentToken'
import { formatMXN, formatPrice } from '../utils/currency'

// Orden de foco ante errores = orden visual del formulario.
const FIELD_ORDER = ['firstName', 'lastName', 'email', 'phone', 'street', 'neighborhood', 'postalCode', 'city', 'state', 'cardNumber', 'cardName', 'cardExpiry', 'cardCvc']
const DELIVERY_DETAIL = { local: 'Los Mochis y ejidos vecinos, con repartidor.', paqueteria: 'A cualquier punto de México.' }

const newKey = () => crypto.randomUUID()

function Section({ number, title, children }) {
  return (
    <section className="border-t border-ink/10 pt-7">
      <h2 className="mb-6 font-serif text-[24px] leading-tight">
        <span className="tnum mr-3 text-[15px] text-ink-soft">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Resultado de la cotización por CP (DESIGN_CHECKOUT.md §3.3). */
function DeliveryQuote({ quote }) {
  if (quote.status === 'idle') return <p className="text-[14px] text-ink-soft">Escriba su código postal para calcular la entrega.</p>
  if (quote.status === 'loading') return <p className="text-[14px] text-ink-soft" role="status">Calculando su entrega…</p>
  if (quote.status === 'error') return <p className="text-[14px] text-ink-soft" role="status">No pudimos calcular la entrega. Se confirmará al pagar.</p>
  return (
    <div className="flex items-baseline justify-between gap-4 border border-ink/15 px-4 py-3" role="status">
      <div>
        <p className="text-[15px]">{deliveryLabel(quote.method)}</p>
        <p className="mt-0.5 text-[13px] text-ink-soft">{DELIVERY_DETAIL[quote.method]}</p>
      </div>
      <p className={`tnum shrink-0 text-[14px] ${quote.cost === 0 ? 'text-matcha' : ''}`}>{quote.cost === 0 ? 'Cortesía' : formatMXN(quote.cost, 2)}</p>
    </div>
  )
}

function PaymentOption({ value, current, onChange, title, detail }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 border px-4 py-3 ${current === value ? 'border-ink' : 'border-ink/15'}`}>
      <input type="radio" name="payment" value={value} checked={current === value} onChange={() => onChange(value)} className="mt-1 h-4 w-4 shrink-0 accent-matcha" />
      <span>
        <span className="block text-[15px]">{title}</span>
        <span className="block text-[13px] text-ink-soft">{detail}</span>
      </span>
    </label>
  )
}

/** Hoja derecha: líneas, furoshiki y totales (DESIGN_CHECKOUT.md §3.5). */
function Summary({ cart, shippingCost, total, ivaRate }) {
  return (
    <>
      <p className={EYEBROW}>Su pedido</p>
      <h2 className="mt-2 font-serif text-[30px] leading-tight font-normal">
        Bolsa del atelier <span className="tnum text-[20px] text-ink-soft">({cart.count})</span>
      </h2>
      <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10" aria-label="Piezas del pedido">
        {cart.items.map((item) => (
          <li key={item.key} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 py-4">
            <div className={`flex h-[68px] w-14 items-center justify-center border border-ink/10 ${item.line === 'sokko' ? 'bg-linen' : 'bg-shelf'}`}>
              <ProductArt product={{ art: item.art, name: item.name, colors: [item.color] }} className="h-[80%] w-[80%]" />
            </div>
            <div className="min-w-0">
              <p className="text-[14.5px] leading-snug">{item.name}</p>
              <p className="mt-0.5 text-[12px] text-ink-soft">
                {item.color.name} · {item.sizeLabel} · {item.unit} · <span className="tnum">× {item.qty}</span>
              </p>
            </div>
            <p className="tnum text-right">
              <span className="block font-serif text-[17px]">{formatPrice(item.price * item.qty)}</span>
              {item.price < item.listPrice && (
                <s className="block text-[12px] text-ink-soft">
                  <span className="sr-only">Precio anterior </span>
                  {formatPrice(item.listPrice * item.qty)}
                </s>
              )}
            </p>
          </li>
        ))}
      </ul>

      <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3">
        <input type="checkbox" checked={cart.giftWrap} onChange={cart.toggleGift} className="mt-1 h-4 w-4 shrink-0 accent-matcha" />
        <span className="text-[13px] leading-snug">
          <span className="text-ink">Envolver en furoshiki de lino reutilizable</span>
          <br />
          <span className="text-ink-soft">Sin costo. Sin plásticos; el paño sirve después como pañuelo o bolsa.</span>
        </span>
      </label>

      <dl className="tnum mt-5 space-y-2 text-[14px]">
        <TotalsRow label="Subtotal">{formatMXN(cart.subtotal, 2)}</TotalsRow>
        <TotalsRow label="Envío">{shippingCost === null ? '—' : shippingCost === 0 ? <span className="text-matcha">Cortesía</span> : formatMXN(shippingCost, 2)}</TotalsRow>
        <TotalsRow label={`IVA incluido (${Math.round(ivaRate * 100)} %)`} muted>
          {formatMXN(taxIncluded(total, ivaRate), 2)}
        </TotalsRow>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-3">
          <dt className="font-serif text-[20px]">Total</dt>
          <dd className="font-serif text-[26px]">
            {formatMXN(total, 2)} <span className="text-[13px] text-ink-soft">MXN</span>
          </dd>
        </div>
      </dl>
    </>
  )
}

/** Checkout (DESIGN_CHECKOUT.md §3). El servidor recalcula todo; la bolsa solo se vacía al confirmar. */
export default function Checkout() {
  const cart = useCart()
  const { user, isAuthenticated } = useAuth()
  const { ivaRate } = useConfig()
  const navigate = useNavigate()
  const [contact, setContact] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: '',
    street: '',
    neighborhood: '',
    postalCode: '',
    city: '',
    state: '',
    references: '',
  })
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvc: '' })
  const [paymentMethod, setPaymentMethod] = useState('tarjeta')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [shortages, setShortages] = useState([])
  const [serverTotal, setServerTotal] = useState(null)
  const [quote, setQuote] = useState({ status: 'idle' })
  const [loading, setLoading] = useState(false)
  const [placed, setPlaced] = useState(false)
  const [shaking, shake] = useShake()
  const keyRef = useRef(null)
  const { subtotal, items } = cart

  // Cotización en vivo; una respuesta vieja nunca pisa a una nueva.
  const postalCode = contact.postalCode.trim()
  useEffect(() => {
    if (!/^\d{5}$/.test(postalCode) || subtotal === 0) return
    let cancelled = false
    quoteShipping(postalCode, subtotal).then(
      (result) => !cancelled && setQuote({ status: 'ready', for: `${postalCode}|${subtotal}`, ...result }),
      () => !cancelled && setQuote({ status: 'error', for: `${postalCode}|${subtotal}` }),
    )
    return () => {
      cancelled = true
    }
  }, [postalCode, subtotal])

  const currentQuote = useMemo(() => {
    if (!/^\d{5}$/.test(postalCode)) return { status: 'idle' }
    return quote.for === `${postalCode}|${subtotal}` ? quote : { status: 'loading' }
  }, [quote, postalCode, subtotal])

  const shippingCost = currentQuote.status === 'ready' ? currentQuote.cost : null
  const computedTotal = subtotal + (shippingCost ?? 0)
  const total = serverTotal ?? computedTotal

  // `errorKey`: en la tarjeta, el error se llama distinto del campo (number → cardNumber).
  const setField = (setter, key, errorKey = key) => (value) => {
    setter((x) => ({ ...x, [key]: value }))
    setErrors((x) => ({ ...x, [errorKey]: undefined }))
    setFormError('')
    setServerTotal(null)
  }
  const field = (key, props) => ({
    id: `checkout-${key}`,
    value: contact[key],
    onChange: setField(setContact, key),
    error: errors[key],
    ...props,
  })

  const fail = (message) => {
    setFormError(message)
    shake()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    setFormError('')
    setShortages([])

    const found = validateCheckout({ contact, card, paymentMethod })
    setErrors(found)
    const first = FIELD_ORDER.find((k) => found[k])
    if (first) {
      const count = Object.keys(found).length
      if (count > 1) setFormError(`Hay ${count} campos por revisar.`)
      shake()
      document.getElementById(`checkout-${first}`)?.focus()
      return
    }

    keyRef.current ??= newKey()
    setLoading(true)
    try {
      const order = await placeOrder(
        {
          firstName: contact.firstName.trim(),
          lastName: contact.lastName.trim(),
          email: contact.email.trim(),
          phone: digitsOnly(contact.phone),
          street: contact.street.trim(),
          neighborhood: contact.neighborhood.trim(),
          city: contact.city.trim(),
          state: contact.state.trim(),
          postalCode,
          references: contact.references.trim() || null,
          giftWrap: cart.giftWrap,
          paymentMethod,
          paymentToken: paymentMethod === 'tarjeta' ? tokenizeCard(card.number) : null,
          // Solo se compara si el cliente ya vio el total con envío: nunca se cobra este valor.
          expectedTotal: shippingCost === null ? null : total,
          items: items.map((i) => ({ sku: i.sku, slug: i.slug, quantity: i.qty })),
        },
        keyRef.current,
      )
      setPlaced(true)
      cart.clear()
      navigate(`/checkout/confirmacion/${order.folio}`, { replace: true })
    } catch (err) {
      setLoading(false)
      const code = err instanceof OrderError ? err.code : 'NETWORK'
      if (code === 'DECLINED') fail(CHECKOUT_MESSAGES[err.declineCode] ?? CHECKOUT_MESSAGES.declined)
      else if (code === 'OUT_OF_STOCK') {
        setShortages(err.lines)
        shake()
      } else if (code === 'PRICE_CHANGED') {
        setServerTotal(err.total)
        fail(`El total de su pedido cambió a ${formatMXN(err.total, 2)}. Revíselo y confirme de nuevo.`)
      } else if (code === 'SESSION_EXPIRED') fail(CHECKOUT_MESSAGES.sessionExpired)
      else if (code === 'RATE_LIMITED') fail(CHECKOUT_MESSAGES.rateLimited)
      else if (code === 'ORDER_CHANGED') {
        keyRef.current = newKey()
        fail(CHECKOUT_MESSAGES.orderChanged)
      } else fail(CHECKOUT_MESSAGES.network)
    }
  }

  // Tras confirmar, la bolsa se vacía antes de que la navegación termine.
  if (placed) return null

  if (items.length === 0) {
    return (
      <CheckoutLayout title="Checkout" aside={<p className="text-[14px] text-ink-soft">Sin piezas por ahora.</p>}>
        <div className="py-16 text-center">
          <span aria-hidden="true" className="font-jp text-[56px] text-ink/15">
            空
          </span>
          <h1 className="mt-2 font-serif text-[28px]">Su bolsa aún está vacía</h1>
          <p className="mt-1 text-[14px] text-ink-soft">Elija una pieza en el atelier.</p>
          <Link to="/" className="mt-8 inline-flex h-[52px] items-center bg-laca px-9 text-[12px] tracking-[.28em] text-linen uppercase transition-colors hover:bg-laca-hover">
            Volver al atelier
          </Link>
        </div>
      </CheckoutLayout>
    )
  }

  const nameOf = (sku) => items.find((i) => i.sku === sku)?.name ?? sku

  return (
    <CheckoutLayout title="Complete su pedido" aside={<Summary cart={cart} shippingCost={shippingCost} total={total} ivaRate={ivaRate} />}>
      <form onSubmit={submit} noValidate className={`flex flex-col gap-9 ${shaking ? 'animate-shake' : ''}`}>
        <header>
          <p className={EYEBROW}>Último paso</p>
          <h1 className="mt-3 font-serif text-[clamp(34px,4vw,48px)] leading-[1.05] font-light">Complete su pedido</h1>
          <p className="mt-4 text-[14px] text-ink-soft">
            {isAuthenticated ? (
              <>Comprando como <span className="text-ink">{user.firstName}</span>.</>
            ) : (
              <>
                ¿Ya tiene cuenta?{' '}
                <Link to="/cuenta?redirect=/checkout" className="inline-flex min-h-11 items-center text-ink underline decoration-ink/25 underline-offset-4">
                  Iniciar sesión
                </Link>
              </>
            )}
          </p>
        </header>

        {formError && <AuthAlert>{formError}</AuthAlert>}
        {shortages.length > 0 && (
          <AuthAlert>
            <p>Algunas piezas ya no están disponibles:</p>
            <ul className="mt-2 list-disc pl-5">
              {shortages.map((line) => (
                <li key={line.sku}>
                  {nameOf(line.sku)}: {line.available > 0 ? `solo quedan ${line.available}` : 'ya no hay piezas'}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                cart.applyLimits(shortages)
                setShortages([])
              }}
              className="mt-3 min-h-11 border border-ink px-5 text-[11.5px] tracking-[.2em] uppercase transition-colors hover:bg-ink hover:text-linen"
            >
              Ajustar mi bolsa
            </button>
          </AuthAlert>
        )}

        <Section number="1" title="Sus datos">
          <div className="grid gap-7 sm:grid-cols-2">
            <AuthField {...field('firstName', { label: 'Nombre', autoComplete: 'given-name' })} />
            <AuthField {...field('lastName', { label: 'Apellido', autoComplete: 'family-name' })} />
            <AuthField {...field('email', { label: 'Correo electrónico', type: 'email', autoComplete: 'email', placeholder: 'nombre@dominio.com', hint: 'Aquí recibirá la confirmación de su pedido.' })} />
            <AuthField {...field('phone', { label: 'Teléfono', type: 'tel', autoComplete: 'tel-national', hint: '10 dígitos, para coordinar la entrega.' })} />
          </div>
        </Section>

        <Section number="2" title="Dirección de entrega">
          <div className="grid gap-7 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <AuthField {...field('street', { label: 'Calle y número', autoComplete: 'address-line1' })} />
            </div>
            <AuthField {...field('neighborhood', { label: 'Colonia', autoComplete: 'address-line2' })} />
            <AuthField {...field('postalCode', { label: 'Código postal', autoComplete: 'postal-code' })} />
            <AuthField {...field('city', { label: 'Ciudad', autoComplete: 'address-level2' })} />
            <AuthField {...field('state', { label: 'Estado', autoComplete: 'address-level1' })} />
            <div className="sm:col-span-2">
              <AuthField {...field('references', { label: 'Referencias (opcional)', hint: 'Entre calles, color de la casa.' })} />
            </div>
          </div>
        </Section>

        <Section number="3" title="Método de entrega">
          <DeliveryQuote quote={currentQuote} />
        </Section>

        <Section number="4" title="Forma de pago">
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Forma de pago</legend>
            <PaymentOption value="tarjeta" current={paymentMethod} onChange={setPaymentMethod} title="Tarjeta" detail="Crédito o débito." />
            <PaymentOption value="oxxo_pay" current={paymentMethod} onChange={setPaymentMethod} title="OXXO Pay" detail="Pague en efectivo en cualquier OXXO." />
          </fieldset>

          {paymentMethod === 'tarjeta' ? (
            <div className="mt-7">
              <p className="mb-6 border-l-2 border-moss pl-3 text-[13px] text-ink-soft">Modo de prueba: no escriba los datos de una tarjeta real.</p>
              <div className="grid gap-7 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <AuthField id="checkout-cardNumber" label="Número de tarjeta" value={card.number} onChange={setField(setCard, 'number', 'cardNumber')} error={errors.cardNumber} autoComplete="cc-number" />
                </div>
                <div className="sm:col-span-2">
                  <AuthField id="checkout-cardName" label="Nombre en la tarjeta" value={card.name} onChange={setField(setCard, 'name', 'cardName')} error={errors.cardName} autoComplete="cc-name" />
                </div>
                <AuthField id="checkout-cardExpiry" label="Vencimiento (MM/AA)" value={card.expiry} onChange={setField(setCard, 'expiry', 'cardExpiry')} error={errors.cardExpiry} autoComplete="cc-exp" placeholder="08/29" />
                <AuthField id="checkout-cardCvc" label="CVC" value={card.cvc} onChange={setField(setCard, 'cvc', 'cardCvc')} error={errors.cardCvc} autoComplete="cc-csc" />
              </div>
            </div>
          ) : (
            <p className="mt-6 text-[14px] leading-relaxed text-ink-soft">
              Le daremos una referencia para pagar en cualquier OXXO. Tiene 72 horas; después el pedido se cancela y las piezas vuelven al atelier.
            </p>
          )}
        </Section>

        <div className="border-t border-ink/10 pt-7">
          <AuthSubmit loading={loading} loadingText={paymentMethod === 'tarjeta' ? 'Procesando su pago…' : 'Generando su referencia…'}>
            {paymentMethod === 'tarjeta' ? `Pagar ${formatMXN(total, 2)}` : 'Generar referencia OXXO'}
          </AuthSubmit>
          <p className="mt-3 text-center text-[12px] text-ink-soft">Al confirmar acepta los términos y el aviso de privacidad.</p>
        </div>
      </form>
    </CheckoutLayout>
  )
}
