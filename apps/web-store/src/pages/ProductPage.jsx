import { useParams } from 'react-router-dom'

/** Ficha de producto (DESIGN_CATALOG_UI.md §3.7). */
export default function ProductPage() {
  const { slug } = useParams()
  return (
    <main className="gutter mx-auto max-w-7xl py-14">
      <h1 className="text-[34px] font-light">{slug}</h1>
    </main>
  )
}
