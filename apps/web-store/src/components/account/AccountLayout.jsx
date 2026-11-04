import { useAuth } from '../../hooks/useAuth'
import { usePageMeta } from '../../hooks/usePageMeta'
import { Eyebrow } from '../info/PageIntro'
import AccountTabs from './AccountTabs'

/** Vistas de la cuenta dentro de la tienda: eyebrow, título, pestañas (solo con sesión) y contenido. */
export default function AccountLayout({ title, description, eyebrow = 'Su cuenta', jp = '口座', heading = title, children }) {
  const { isAuthenticated } = useAuth()
  usePageMeta(title, description)

  return (
    <main className="gutter mx-auto max-w-7xl pt-10 pb-20 md:pt-14">
      <Eyebrow jp={jp}>{eyebrow}</Eyebrow>
      <h1 className="mt-4 mb-8 font-serif text-[clamp(34px,4.4vw,56px)] leading-[1.05] font-light">{heading}</h1>
      {isAuthenticated && <AccountTabs />}
      <div className="pt-8 md:pt-10">{children}</div>
    </main>
  )
}
