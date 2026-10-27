import { useParams } from 'react-router-dom'
import { label, LINE_LABELS } from '../config/enums'
import NotFound from './NotFound'

/** Listado por línea (DESIGN_CATALOG_UI.md §3.5). */
export default function LinePage() {
  const { line } = useParams()
  if (!LINE_LABELS[line]) return <NotFound />
  return (
    <main className="gutter mx-auto max-w-7xl py-14">
      <h1 className="text-[34px] font-light">{label(LINE_LABELS, line)}</h1>
    </main>
  )
}
