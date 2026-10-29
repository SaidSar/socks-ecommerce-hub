import ProductCard from '../product/ProductCard'

/** Cuadrícula de tarjetas: 2 columnas en móvil, 4 desde lg. */
export default function ProductGrid({ products, showLine = false }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.slug} className="min-w-0">
          <ProductCard product={p} showLine={showLine} />
        </li>
      ))}
    </ul>
  )
}
