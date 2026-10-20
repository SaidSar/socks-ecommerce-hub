import { useState } from 'react'
import { useWidth } from '../../hooks/useWidth'
import { formatDate, formatMXN, formatShortWeekday } from '../../utils/format'

// Par validado Ai + Ocre (DESIGN_ADMIN.md §2). No agregar series con otros colores sin validar.
const AI = '#2F5E9E'
const OCRE = '#B07A3C'
const GRID = '#EDE7DF'
const LABEL = '#6A645C'

/**
 * Ventas por día (30 días) contra el periodo anterior. SVG propio: cuadrícula tenue, etiquetas cada 7 días,
 * punto final enfatizado, crosshair + tooltip al pasar el cursor y tabla equivalente oculta para lectores de pantalla.
 * data: [{ date, v, prev }]
 */
export default function SalesChart({ data }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  const h = 230
  const pl = 52
  const pr = 12
  const pt = 14
  const pb = 28
  const max = Math.max(2000, Math.ceil(Math.max(...data.map((d) => Math.max(d.v, d.prev))) / 2000) * 2000)
  const innerW = Math.max(1, w - pl - pr)
  const x = (i) => pl + (i * innerW) / (data.length - 1)
  const y = (v) => pt + (1 - v / max) * (h - pt - pb)
  const line = (k) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join('')
  const area = `${line('v')}L${x(data.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z`
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max]
  const last = data.length - 1

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - pl) / innerW) * last)
    setHover(Math.max(0, Math.min(last, i)))
  }
  const hd = hover != null ? data[hover] : null

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={h}
        className="block overflow-visible"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Ventas por día de los últimos 30 días comparadas con el periodo anterior. La tabla siguiente tiene los valores."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={w - pr} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={LABEL} className="tnum">
              {t === 0 ? '$0' : `$${(t / 1000).toFixed(0)}k`}
            </text>
          </g>
        ))}
        {data.map(
          (d, i) =>
            (i % 7 === 2 || i === last) && (
              <text key={d.date} x={x(i)} y={h - 8} textAnchor={i === last ? 'end' : 'middle'} fontSize="11" fill={LABEL}>
                {formatDate(d.date)}
              </text>
            ),
        )}
        <path d={area} fill={AI} opacity=".08" />
        <path d={line('prev')} fill="none" stroke={OCRE} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        <path d={line('v')} fill="none" stroke={AI} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(last)} cy={y(data[last].v)} r="4.5" fill={AI} stroke="#fff" strokeWidth="2" />
        {hd && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pt} y2={h - pb} stroke="#23211E" strokeOpacity=".25" />
            <circle cx={x(hover)} cy={y(hd.prev)} r="4" fill={OCRE} stroke="#fff" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(hd.v)} r="4.5" fill={AI} stroke="#fff" strokeWidth="2" />
          </g>
        )}
        <rect x={pl} y={pt} width={innerW} height={h - pt - pb} fill="transparent" />
      </svg>
      {hd && (
        <div
          className="absolute pointer-events-none bg-ink text-linen rounded-md px-3 py-2 text-[12px] shadow-lg tnum"
          style={{ left: Math.min(Math.max(x(hover) - 80, 0), Math.max(0, w - 170)), top: 0, width: 170 }}
          aria-hidden="true"
        >
          <p className="font-medium">{formatShortWeekday(hd.date)}</p>
          <p className="flex justify-between mt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#7FA3D6]" />
              Este periodo
            </span>
            {formatMXN(hd.v)}
          </p>
          <p className="flex justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D9A971]" />
              Anterior
            </span>
            {formatMXN(hd.prev)}
          </p>
        </div>
      )}
      <table className="sr-only">
        <caption>Ventas por día, MXN con IVA</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Este periodo</th>
            <th scope="col">Periodo anterior</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatShortWeekday(d.date)}</th>
              <td>{formatMXN(d.v)}</td>
              <td>{formatMXN(d.prev)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
