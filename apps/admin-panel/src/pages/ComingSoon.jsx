import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import { navByKey } from '../config/navigation'

/** Sección aún sin construir: lista lo que llegará en la siguiente iteración (textos del mockup). */
export default function ComingSoon({ section }) {
  const nav = navByKey(section)
  return (
    <>
      <PageHeader title={nav.label} />
      <Card className="px-6 py-12 text-center animate-fade">
        <p className="font-jp text-[44px] text-ink/15 leading-none" aria-hidden="true">
          準備
        </p>
        <h2 className="text-[17px] font-semibold mt-3">{nav.label} llega en la siguiente iteración</h2>
        <ul className="mt-4 inline-flex flex-col gap-1.5 text-left text-[13px] text-ink-soft">
          {nav.soon.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true">·</span>
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
