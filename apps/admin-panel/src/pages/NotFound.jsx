import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'

export default function NotFound() {
  return (
    <>
      <PageHeader title="Página no encontrada" />
      <Card className="px-6 py-12 text-center">
        <p className="text-[14px] font-medium">Esta dirección no existe en el panel.</p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center justify-center h-10 max-lg:h-11 px-4 rounded-md bg-ink hover:bg-black text-linen text-[13.5px] font-medium"
        >
          Ir al dashboard
        </Link>
      </Card>
    </>
  )
}
