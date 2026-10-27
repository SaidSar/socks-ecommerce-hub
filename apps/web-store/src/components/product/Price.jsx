import { formatPrice } from '../../utils/currency'

/**
 * Precio que ya calculó el servicio (R-29). Con descuento: precio en ocre-ink y el de lista tachado,
 * con texto accesible "Precio anterior $199".
 */
export default function Price({ product, size = 'card', className = '' }) {
  const discounted = product.price < product.listPrice
  const big = size === 'big'
  return (
    <span className={`tnum flex flex-wrap items-baseline gap-2 ${big ? 'text-[26px]' : 'text-[15px]'} ${className}`}>
      <span className={discounted ? 'font-medium text-ocre-ink' : ''}>{formatPrice(product.price)}</span>
      {discounted && (
        <s className={`text-ink-soft ${big ? 'text-[16px]' : 'text-[12.5px]'}`}>
          <span className="sr-only">Precio anterior </span>
          {formatPrice(product.listPrice)}
        </s>
      )}
    </span>
  )
}
