import { useId, useState } from 'react'
import BotanicalPlate from './BotanicalPlate'

const ITEMS = [
  {
    n: '01',
    title: 'Algodón Peinado Densidad 200',
    jp: '綿',
    summary: 'Suavidad que respira y perdura tras cada lavado.',
    note: 'Fibra larga de cosecha selecta; se peina para retirar fibras cortas antes de hilar. Resultado: menos pelusa y un tejido que no pierde forma.',
    plate: 'cotton',
    tag: 'Fibra natural',
  },
  {
    n: '02',
    title: 'Patrón Tabi de Punta Dividida',
    jp: '足袋',
    summary: 'Liberación del pulgar para equilibrar la pisada corporal.',
    note: 'El hallux se mueve con independencia, el peso se reparte mejor y el arco trabaja sin tensión. La costura de la punta se cierra a mano.',
    plate: 'tabi',
    tag: 'Patrón anatómico',
  },
  {
    n: '03',
    title: 'Pigmentos Minerales & Tintes Washi',
    jp: '色',
    summary: 'Colores naturales que no dañan la piel.',
    note: 'Tintes de té, tierra ocre y pigmento mineral fijados a baja temperatura. Cada lote varía apenas en tono: esa diferencia es parte de la pieza.',
    plate: 'pigment',
    tag: 'Tinte de bajo impacto',
  },
]

/** Curaduría de la materia prima: acordeón de una sola fila abierta (DESIGN.md §6.6). */
export default function MateriaCuration() {
  const [selected, setSelected] = useState(0)
  const baseId = useId()

  return (
    <section id="materia" className="gutter scroll-mt-20 bg-sand py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 grid gap-6 lg:grid-cols-12">
          <p className="pt-3 text-[11px] tracking-[.32em] text-matcha uppercase lg:col-span-3">
            Curaduría de la materia prima
          </p>
          <h2 className="font-serif text-[clamp(32px,4.6vw,58px)] leading-[1.05] font-light lg:col-span-8">
            Tres decisiones que <em className="italic">se sienten</em> antes de verse.
          </h2>
        </div>

        <div className="border-t border-ink/15">
          {ITEMS.map((it, i) => {
            const on = selected === i
            const noteId = `${baseId}-nota-${i}`
            return (
              <button
                key={it.n}
                type="button"
                onClick={() => setSelected(i)}
                aria-expanded={on}
                aria-controls={noteId}
                className={`grid w-full grid-cols-[auto_1fr] items-start gap-x-6 gap-y-3 border-b border-ink/15 py-8 text-left transition-colors md:grid-cols-[5rem_8rem_1fr_auto] ${
                  on ? 'bg-linen/60' : 'hover:bg-linen/30'
                }`}
              >
                <span className="pt-1 font-serif text-[26px] leading-none text-laca md:pl-3">{it.n}.</span>

                <span
                  className={`${on ? 'block' : 'hidden md:block'} col-span-2 row-start-2 h-32 w-28 border border-ink/10 bg-[#FBF9F6] p-2 transition-opacity md:col-span-1 md:row-start-auto md:h-36 md:w-32 ${
                    on ? 'opacity-100' : 'opacity-60'
                  }`}
                >
                  <BotanicalPlate variant={it.plate} />
                </span>

                <span className="col-start-2 row-start-1 block min-w-0 md:col-start-auto md:row-start-auto">
                  <span className="block font-serif text-[clamp(22px,2.6vw,30px)] leading-tight">{it.title}</span>
                  <span className="mt-2 block text-[14px] text-ink-soft">{it.summary}</span>
                  <span
                    id={noteId}
                    hidden={!on}
                    className="animate-fade mt-4 block max-w-[38rem] text-[14px] leading-[1.8] text-ink/80"
                  >
                    {it.note}
                  </span>
                  <span className="mt-4 inline-block border border-moss/60 px-2.5 py-1 text-[10.5px] tracking-[.2em] text-matcha uppercase">
                    {it.tag}
                  </span>
                </span>

                <span aria-hidden="true" className="hidden pr-3 font-jp text-[38px] text-ink/15 md:block">
                  {it.jp}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
