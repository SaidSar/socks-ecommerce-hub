import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Icon from '../components/ui/Icon'

/** Ruta sin permiso para el rol de la sesión. */
export default function Forbidden({ title = 'Sin acceso' }) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="px-6 py-12 flex flex-col items-center text-center animate-fade">
        <Icon name="alert" className="w-8 h-8 text-ink-soft" />
        <p className="text-[15px] font-medium mt-3">Esta sección es solo para el Dueño.</p>
        <p className="text-[12.5px] text-ink-soft mt-1">Si necesita entrar, pídale al Dueño que revise su rol.</p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center h-10 max-lg:h-11 px-4 rounded-md bg-ink hover:bg-black text-linen text-[13.5px] font-medium"
        >
          Ir al dashboard
        </Link>
      </Card>
    </>
  )
}
