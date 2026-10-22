import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCart } from '../../hooks/useCart'
import { useConfig } from '../../hooks/useConfig'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll'
import { formatMXN } from '../../utils/currency'
import { CloseIcon } from '../brand/Icons'
import BrushProgress from './BrushProgress'
import CartLine from './CartLine'

const PAYING_MS = 2200
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Bolsa del atelier (DESIGN.md §6.9). */
export default function CartDrawer() {
  const cart = useCart()
  const { freeShippingThreshold } = useConfig()
  const { isOpen, close, items, count, subtotal, shipping, total, ivaIncluded, progress, missing, isFree, giftWrap } =
    cart
  const [paying, setPaying] = useState(false)
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const triggerRef = useRef(null)
  const payTimer = useRef(null)
  const titleId = useId()

  useLockBodyScroll(isOpen)

  // Foco: al abrir va al botón de cierre; al cerrar regresa al disparador.
  useEffect(() => {
    if (!isOpen) return
    triggerRef.current = document.activeElement
    closeRef.current?.focus()
    return () => {
      const trigger = triggerRef.current
      if (trigger && document.contains(trigger)) trigger.focus()
    }
  }, [isOpen])

  // Esc cierra; Tab / Shift+Tab ciclan dentro del panel (focus trap).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)]
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  useEffect(() => () => clearTimeout(payTimer.current), [])

  const pay = () => {
    // TODO(checkout): crear la orden vía POST /api/orders y redirigir a la pasarela de pago.
    setPaying(true)
    clearTimeout(payTimer.current)
    payTimer.current = setTimeout(() => setPaying(false), PAYING_MS)
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`} inert={!isOpen}>
      <div
        aria-hidden="true"
        onClick={close}
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`linen-tex absolute top-0 right-0 flex h-full w-full max-w-[460px] flex-col bg-linen pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-500 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between px-7 pt-7 pb-5">
          <div>
            <p className="text-[11px] tracking-[.3em] text-matcha uppercase">Su selección</p>
            <h2 id={titleId} className="mt-1 font-serif text-[30px] leading-tight font-normal">
              Bolsa del atelier <span className="tnum text-[20px] text-ink-soft">({count})</span>
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Cerrar bolsa"
            className="-mr-2.5 flex h-11 w-11 items-center justify-center text-ink-soft hover:text-ink"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="border-b border-ink/10 px-7 pb-6">
          <BrushProgress progress={progress} reached={isFree} value={subtotal} max={freeShippingThreshold} missing={missing} />
          <p className="mt-2 font-serif text-[16.5px] text-ink/85 italic">
            {subtotal === 0 ? (
              <>El envío es de cortesía a partir de {formatMXN(freeShippingThreshold)}.</>
            ) : !isFree ? (
              <>
                Faltan <span className="tnum text-laca not-italic">{formatMXN(missing)}</span> para su envío de cortesía.
              </>
            ) : (
              <>Su envío a cualquier punto de México corre por nuestra cuenta.</>
            )}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-7">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <span aria-hidden="true" className="font-jp text-[56px] text-ink/15">
                空
              </span>
              <p className="mt-2 font-serif text-[22px]">Su bolsa aún está vacía</p>
              <p className="mt-1 text-[13px] text-ink-soft">Elija una pieza en el atelier.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink/10" aria-label="Piezas en la bolsa">
              {items.map((item) => (
                <CartLine key={item.key} item={item} onSetQty={cart.setQty} onRemove={cart.remove} />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-ink/10 bg-sand/70 px-7 py-6">
          <label className="mb-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={giftWrap}
              onChange={cart.toggleGift}
              className="mt-1 h-4 w-4 shrink-0 accent-matcha"
            />
            <span className="text-[13px] leading-snug">
              <span className="text-ink">Envolver en furoshiki de lino reutilizable</span>
              <br />
              <span className="text-ink-soft">Sin costo. Sin plásticos; el paño sirve después como pañuelo o bolsa.</span>
            </span>
          </label>

          <dl className="tnum space-y-2 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatMXN(subtotal, 2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Envío</dt>
              <dd className={shipping === 0 && subtotal > 0 ? 'text-matcha' : ''}>
                {subtotal === 0 ? '—' : shipping ? formatMXN(shipping, 2) : 'Cortesía'}
              </dd>
            </div>
            <div className="flex justify-between text-[12.5px]">
              <dt className="text-ink-soft">IVA incluido (16 %)</dt>
              <dd className="text-ink-soft">{formatMXN(ivaIncluded, 2)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink/15 pt-3">
              <dt className="font-serif text-[20px]">Total</dt>
              <dd className="font-serif text-[26px]">
                {formatMXN(total, 2)} <span className="text-[13px] text-ink-soft">MXN</span>
              </dd>
            </div>
          </dl>

          <button
            type="button"
            disabled={!items.length || paying}
            onClick={pay}
            aria-live="polite"
            className="mt-5 w-full bg-laca py-4 text-[12px] tracking-[.28em] text-linen uppercase transition-colors hover:bg-laca-hover disabled:cursor-not-allowed disabled:bg-sand-2 disabled:text-ink-soft"
          >
            {paying ? 'Conectando con pago seguro…' : 'Proceder al Pago Seguro'}
          </button>
          <p className="mt-3 text-center text-[11px] text-ink-soft">Tarjeta o OXXO Pay</p>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
