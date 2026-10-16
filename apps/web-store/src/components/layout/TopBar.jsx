import { FREE_SHIPPING } from '../../config/commerce'
import { formatMXN } from '../../utils/currency'

export default function TopBar() {
  return (
    <div className="gutter border-b border-ink/10 bg-sand pt-[env(safe-area-inset-top,0px)]">
      <p className="mx-auto max-w-7xl py-2.5 text-center text-[12px] tracking-[.06em] text-ink-soft">
        Envío de cortesía a todo México a partir de {formatMXN(FREE_SHIPPING)} MXN{' '}
        <span className="mx-2 text-laca" aria-hidden="true">
          ·
        </span>{' '}
        <span className="font-serif text-[14px] italic">Cada par tejido con respeto al pie</span>
      </p>
    </div>
  )
}
