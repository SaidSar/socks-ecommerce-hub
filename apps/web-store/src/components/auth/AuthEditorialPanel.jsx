import { Link } from 'react-router-dom'
import Logo from '../brand/Logo'
import KnitTabi from '../product/KnitTabi'

// Hoja izquierda del biombo por vista (DESIGN_AUTH.md §2, §4.1). Los tonos coinciden con TONES del catálogo.
const PANEL = {
  login: {
    kanji: '入',
    eyebrow: 'Regresar al atelier',
    title: (
      <>
        Sus pasos <em className="italic">le esperan</em>.
      </>
    ),
    tone: 'sumi',
  },
  register: {
    kanji: '新',
    eyebrow: 'Unirse al atelier',
    title: (
      <>
        Una cuenta, <em className="italic">un ritmo propio</em>.
      </>
    ),
    tone: 'washi',
  },
  forgot: {
    kanji: '鍵',
    eyebrow: 'Recuperar acceso',
    title: (
      <>
        Un nuevo <em className="italic">comienzo</em>.
      </>
    ),
    tone: 'matcha',
  },
  reset: {
    kanji: '鍵',
    eyebrow: 'Recuperar acceso',
    title: (
      <>
        Un nuevo <em className="italic">comienzo</em>.
      </>
    ),
    tone: 'matcha',
  },
  welcome: {
    kanji: '迎',
    eyebrow: 'Bienvenida',
    title: (
      <>
        El atelier <em className="italic">es suyo</em>.
      </>
    ),
    tone: 'laca',
  },
}

const BENEFITS = [
  ['01', 'Su talla guardada', 'Cada pieza aparece ya en S, M o L según su pie.'],
  ['02', 'Ediciones limitadas primero', 'Aviso 48 horas antes de que un tiraje numerado salga a la venta.'],
  ['03', 'Historial y cambios', 'Sus pedidos, guías de rastreo y cambios en 30 días, en un solo lugar.'],
]

/** Panel editorial del acceso: franja superior en móvil, hoja completa desde lg. */
export default function AuthEditorialPanel({ view }) {
  const p = PANEL[view] ?? PANEL.login

  return (
    <aside className="linen-tex relative overflow-hidden bg-sand lg:min-h-full" aria-label="Por qué crear una cuenta">
      <span
        key={p.kanji}
        aria-hidden="true"
        className="animate-fade pointer-events-none absolute top-[-4%] right-[-6%] font-jp text-[clamp(220px,30vw,420px)] leading-none text-ink/[.05] select-none"
      >
        {p.kanji}
      </span>

      <div className="gutter relative flex h-full flex-col py-10 lg:py-16 lg:pr-12">
        <div className="self-start">
          <Link to="/" aria-label="SOKKO, volver a la tienda" className="inline-flex min-h-11 items-center">
            <Logo variant="horizontal" className="h-10 md:h-11" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-[1fr_auto] items-end gap-6 lg:mt-16 lg:grid-cols-1">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[.32em] text-matcha uppercase">{p.eyebrow}</p>
            <p key={view} className="animate-fade mt-4 font-serif text-[clamp(32px,4.2vw,56px)] leading-[1.02] font-light">
              {p.title}
            </p>
          </div>
          <div className="relative aspect-[4/5] w-[110px] sm:w-[150px] lg:mt-6 lg:w-[min(320px,70%)]" aria-hidden="true">
            <div className="absolute inset-0 border border-ink/10 bg-linen/60" />
            <div className="absolute top-[26%] left-[20%] aspect-square w-[30%] rounded-full bg-laca/90" />
            <KnitTabi
              key={view}
              tone={p.tone}
              className="animate-fade absolute inset-0 m-auto h-[80%] drop-shadow-[0_18px_18px_rgba(35,33,30,.12)]"
            />
          </div>
        </div>

        <ol className="mt-12 hidden max-w-md border-t border-ink/15 lg:block">
          {BENEFITS.map(([n, title, text]) => (
            <li key={n} className="grid grid-cols-[2.5rem_1fr] border-b border-ink/15 py-4">
              <span className="pt-1 font-serif text-[18px] leading-none text-laca">{n}.</span>
              <span>
                <span className="block font-serif text-[20px] leading-tight">{title}</span>
                <span className="mt-1 block text-[13px] text-ink-soft">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-auto hidden max-w-sm pt-10 font-serif text-[15px] text-ink-soft italic lg:block">
          “Cada par tejido con respeto al pie.”
        </p>
      </div>
    </aside>
  )
}
