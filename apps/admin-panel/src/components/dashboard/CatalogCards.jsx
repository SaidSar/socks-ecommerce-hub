import { Link, useNavigate } from 'react-router-dom'
import { dayMonth, label, LINE_LABELS } from '../../domain/enums'
import { formatInt, formatMXN } from '../../utils/format'
import { LineTag, Pill, TABLE, TD, TH } from '../catalog/CatalogUi'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'

const pct = (n) => `${Math.round(n * 100)} %`

/**
 * Ventas (Dueño) o unidades (Operaciones) por línea (DESIGN_CATALOG_UI.md §4.2): barras en `ai`, etiqueta dentro y
 * "% del total"; clic → Productos filtrado por la línea. El Dueño ve además Unidades / Ingreso / Margen bruto.
 */
function LineBars({ lines, owner }) {
  const navigate = useNavigate()
  const value = (l) => (owner ? l.revenue : l.units)
  const total = lines.reduce((a, l) => a + value(l), 0)
  const max = Math.max(1, ...lines.map(value))
  const fmt = (v) => (owner ? formatMXN(v) : `${formatInt(v)} u.`)

  return (
    <Card className="min-w-0" aria-labelledby="lines-title">
      <CardHead
        id="lines-title"
        title={owner ? 'Ventas por línea' : 'Unidades por línea'}
        sub={`${owner ? formatMXN(total) : `${formatInt(total)} unidades`} · en el periodo`}
      />
      <ul className="flex flex-col gap-3 px-5 pb-5">
        {lines.map((l) => {
          const v = value(l)
          const share = total ? Math.round((v / total) * 100) : 0
          return (
            <li key={l.line}>
              <button
                type="button"
                onClick={() => navigate(`/catalogo/productos?linea=${l.line}`)}
                aria-label={`${fmt(v)} en ${label(LINE_LABELS, l.line)}, ${share} % del total. Ver productos de la línea.`}
                className="group grid w-full grid-cols-[96px_minmax(0,1fr)] items-center gap-3 rounded-sm text-left sm:grid-cols-[112px_minmax(0,1fr)_88px]"
              >
                <LineTag line={l.line} />
                <span className="relative h-7 overflow-hidden rounded-sm bg-linen">
                  <span className="absolute inset-y-0 left-0 rounded-sm bg-ai group-hover:opacity-90" style={{ width: `${(v / max) * 100}%` }} />
                  {/* Barra corta: la etiqueta va justo después de la barra, en tinta, para conservar el contraste. */}
                  <span
                    className={`tnum absolute inset-y-0 flex items-center text-[12px] font-medium ${v / max > 0.35 ? 'left-2 text-white' : 'text-ink'}`}
                    style={v / max > 0.35 ? undefined : { left: `calc(${(v / max) * 100}% + 6px)` }}
                  >
                    {fmt(v)}
                  </span>
                </span>
                <span className="tnum hidden text-right text-[12px] text-ink-soft sm:block">{share} % del total</span>
              </button>
            </li>
          )
        })}
      </ul>
      {owner && (
        <div className="overflow-x-auto border-t border-line">
          <table className={`${TABLE} min-w-[480px]`}>
            <thead>
              <tr>
                <th className={TH}>Línea</th>
                <th className={`${TH} text-right`}>Unidades</th>
                <th className={`${TH} text-right`}>Ingreso</th>
                <th className={`${TH} text-right`}>Margen bruto</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.line} className="last:[&>td]:border-b-0">
                  <td className={TD}>
                    <LineTag line={l.line} />
                  </td>
                  <td className={`${TD} tnum text-right`}>{formatInt(l.units)}</td>
                  <td className={`${TD} tnum text-right`}>{formatMXN(l.revenue)}</td>
                  <td className={`${TD} tnum text-right whitespace-nowrap`}>
                    {l.margin == null ? '—' : pct(l.margin)}
                    {l.missingCost > 0 && (
                      <Pill tone="warn" className="ml-2" title="Productos sin costo registrado: no entran en el margen">
                        {l.missingCost} sin costo
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Seasons({ seasons }) {
  return (
    <Card className="min-w-0" aria-labelledby="seasons-title">
      <CardHead
        id="seasons-title"
        title="Temporadas"
        right={
          <Link to="/catalogo/colecciones" className="text-[12.5px] text-ai hover:underline">
            Ver colecciones
          </Link>
        }
      />
      <ul className="flex flex-col gap-3 px-5">
        {seasons.map((c) => (
          <li key={c.slug} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-md border border-line px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-medium">
                {c.name}{' '}
                <span className="text-[12.5px] font-normal text-ink-soft">
                  · {dayMonth(c.startMonth, c.startDay)} → {dayMonth(c.endMonth, c.endDay)}
                </span>
              </p>
              <p className="text-[12px] text-ink-soft">{formatInt(c.stock)} unidades en stock</p>
            </div>
            <Pill tone={c.status.tone}>{c.status.text}</Pill>
          </li>
        ))}
      </ul>
      <p className="px-5 pt-3 pb-5 text-[12px] leading-relaxed text-ink-soft">
        Fuera de temporada, los productos salen del menú y del Home de la tienda, y quedan en el buscador con el descuento de su colección.
      </p>
    </Card>
  )
}

function BrandMargins({ brands }) {
  return (
    <Card className="min-w-0" aria-labelledby="brands-title">
      <CardHead id="brands-title" title="Margen por marca" sub="Solo productos con costo registrado" />
      <div className="overflow-x-auto">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Marca</th>
              <th className={`${TH} text-right`}>Ingreso</th>
              <th className={`${TH} text-right`}>Margen</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.slug} className="last:[&>td]:border-b-0">
                <td className={TD}>{b.name}</td>
                <td className={`${TD} tnum text-right`}>{formatMXN(b.revenue)}</td>
                <td className={`${TD} tnum text-right`}>{pct(b.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function FewUnits({ products, few }) {
  return (
    <Card className="min-w-0" aria-labelledby="few-title">
      <CardHead id="few-title" title="Pocas unidades" sub={`Productos con ${few} unidades o menos en stock`} />
      {products.length ? (
        <ul className="flex flex-col divide-y divide-line px-5 pb-3">
          {products.map((p) => (
            <li key={p.slug} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">{p.name}</span>
              <Pill tone="crit" className="tnum">
                {p.stock}
              </Pill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-5 text-[13px] text-ink-soft">Todos los productos tienen más de {few} unidades.</p>
      )}
    </Card>
  )
}

/** Bloque del catálogo multilínea en el Dashboard (§4.2). */
export default function CatalogCards({ summary, owner, few }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <LineBars lines={summary.lines} owner={owner} />
      <div className="flex min-w-0 flex-col gap-5">
        <Seasons seasons={summary.seasons} />
        {owner ? <BrandMargins brands={summary.brands} /> : <FewUnits products={summary.fewUnits} few={few} />}
      </div>
    </div>
  )
}
