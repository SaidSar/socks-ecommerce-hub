import { Link } from 'react-router-dom'
import PageIntro, { BODY, H2, SideIndex } from '../components/info/PageIntro'
import { STORE_EMAIL } from '../content/legal'
import { useConfig } from '../hooks/useConfig'
import { usePageMeta } from '../hooks/usePageMeta'
import { formatDate } from '../utils/orderDates'
import { formatMXN } from '../utils/currency'
import { AcademicNotice } from './LegalPage'
import Breadcrumbs from '../components/layout/Breadcrumbs'

const UPDATED = '2026-11-03T19:00:00Z'

const SECTIONS = [
  { id: 'preparacion', title: 'Preparación' },
  { id: 'cobertura', title: 'Cobertura' },
  { id: 'rastreo', title: 'Rastreo' },
  { id: 'oxxo', title: 'Pagos con OXXO' },
  { id: 'incidencias', title: 'Incidencias' },
]

const CARD_LABEL = 'text-[11px] tracking-[.24em] uppercase'

/** Política de envíos. Montos y reglas de GET /api/config (useConfig cae al respaldo si la API no responde). */
export default function Shipping() {
  const { freeShippingThreshold, parcelShippingCost, localShippingCost, localFreeShipping } = useConfig()
  const free = formatMXN(freeShippingThreshold)
  usePageMeta(
    'Envíos',
    `Política de envíos de SOKKO: paquetería a todo México por ${formatMXN(parcelShippingCost)}, entrega local en Los Mochis y envío de cortesía desde ${free}.`,
  )

  return (
    <main className="gutter mx-auto max-w-7xl pt-2 pb-14 md:pt-4 md:pb-20">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Envíos' }]} className="mb-8 md:mb-12" />
      <AcademicNotice />

      <PageIntro eyebrow="Ayuda" jp="配送" title="Envíos" className="mt-12">
        <p>Cada pedido sale envuelto a mano desde nuestro taller en Sinaloa. Estos son los costos, plazos y coberturas vigentes.</p>
      </PageIntro>

      <ul className="mt-12 grid gap-4 md:grid-cols-3" aria-label="Tarifas de envío">
        <li className="flex flex-col gap-3 border border-ink/10 bg-sand p-7">
          <span className={`${CARD_LABEL} text-matcha`}>Paquetería nacional</span>
          <span className="tnum font-serif text-[44px] leading-none font-light">{formatMXN(parcelShippingCost)}</span>
          <span className="text-[13.5px] leading-relaxed text-ink-soft">A cualquier punto de México, de 3 a 5 días hábiles.</span>
        </li>
        <li className="flex flex-col gap-3 bg-ink p-7 text-linen">
          <span className={`${CARD_LABEL} text-sand-2`}>Envío de cortesía</span>
          <span className="tnum font-serif text-[44px] leading-none font-light">Desde {free}</span>
          <span className="text-[13.5px] leading-relaxed text-sand-2">
            En compras de {free} o más, en cualquier línea{localFreeShipping ? ', también con entrega local' : ' (solo paquetería)'}.
          </span>
        </li>
        <li className="flex flex-col gap-3 border border-ink/10 bg-sand p-7">
          <span className={`${CARD_LABEL} text-matcha`}>Entrega local</span>
          <span className="tnum font-serif text-[44px] leading-none font-light">{formatMXN(localShippingCost)}</span>
          <span className="text-[13.5px] leading-relaxed text-ink-soft">Los Mochis y ejidos vecinos, con repartidor, normalmente al día siguiente.</span>
        </li>
      </ul>

      <div className="mt-16 grid gap-12 lg:grid-cols-[220px_minmax(0,720px)] lg:gap-20">
        <SideIndex label="En esta página" items={SECTIONS} />

        <article className={`max-w-[720px] space-y-12 ${BODY}`}>
          <section id="preparacion" aria-labelledby="preparacion-t" className="scroll-mt-28">
            <h2 id="preparacion-t" className={`${H2} text-ink`}>
              Preparación
            </h2>
            <p className="mt-4">
              Preparamos y envolvemos su pedido en 1 a 2 días hábiles después de confirmar el pago. Los pedidos de fin de semana o días
              festivos salen el siguiente día hábil.
            </p>
          </section>

          <section id="cobertura" aria-labelledby="cobertura-t" className="scroll-mt-28">
            <h2 id="cobertura-t" className={`${H2} text-ink`}>
              Cobertura
            </h2>
            <p className="mt-4">
              Enviamos a toda la República Mexicana por paquetería ({formatMXN(parcelShippingCost)}, de 3 a 5 días hábiles tras la
              preparación). Si su código postal es de Los Mochis o de los ejidos vecinos, el checkout le ofrece la entrega local (
              {formatMXN(localShippingCost)}). Desde {free} de compra el envío corre por nuestra cuenta. Por ahora no enviamos al
              extranjero.
            </p>
          </section>

          <section id="rastreo" aria-labelledby="rastreo-t" className="scroll-mt-28">
            <h2 id="rastreo-t" className={`${H2} text-ink`}>
              Rastreo
            </h2>
            <p className="mt-4">
              Al salir su paquete le enviamos por correo la paquetería y el número de guía. Si compró con cuenta, también los ve en{' '}
              <Link to="/cuenta/pedidos" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
                Mis pedidos
              </Link>
              ; si compró como invitado, en{' '}
              <Link to="/rastreo" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
                Rastrear pedido
              </Link>
              , con su folio y su correo.
            </p>
          </section>

          <section id="oxxo" aria-labelledby="oxxo-t" className="scroll-mt-28">
            <h2 id="oxxo-t" className={`${H2} text-ink`}>
              Pagos con OXXO
            </h2>
            <p className="mt-4">
              Con OXXO Pay sus piezas quedan apartadas 72 horas. El plazo de preparación empieza cuando se acredita el pago; si no se paga a
              tiempo, el pedido se cancela y no se envía.
            </p>
          </section>

          <section id="incidencias" aria-labelledby="incidencias-t" className="scroll-mt-28">
            <h2 id="incidencias-t" className={`${H2} text-ink`}>
              Incidencias
            </h2>
            <p className="mt-4">
              Si su paquete llega abierto, dañado o incompleto, escríbanos a {STORE_EMAIL} o desde el{' '}
              <Link to="/contacto" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
                formulario de contacto
              </Link>{' '}
              dentro de las 48 horas siguientes a la entrega, con una foto del empaque y de las piezas. Revisamos cada caso y, si procede,
              reponemos la pieza sin costo.
            </p>
          </section>

          <p className="border-t border-ink/10 pt-6 text-[13px]">
            Última actualización: <time dateTime={UPDATED.slice(0, 10)}>{formatDate(UPDATED)}</time>
          </p>
        </article>
      </div>
    </main>
  )
}
