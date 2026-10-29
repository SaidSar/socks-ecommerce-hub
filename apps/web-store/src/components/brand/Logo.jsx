import isotipoUrl from '../../assets/brand/sokko-isotipo.svg'
import isotipoDarkUrl from '../../assets/brand/sokko-isotipo-on-dark.svg'
import horizontalUrl from '../../assets/brand/sokko-logo-horizontal.svg'
import horizontalDarkUrl from '../../assets/brand/sokko-logo-horizontal-on-dark.svg'
import verticalUrl from '../../assets/brand/sokko-logo.svg'
import verticalDarkUrl from '../../assets/brand/sokko-logo-on-dark.svg'

// Archivos oficiales del cliente, sin modificar (docs/brand/README.md). `dark` solo sobre fondo tinta.
const SOURCES = {
  horizontal: { light: horizontalUrl, dark: horizontalDarkUrl },
  vertical: { light: verticalUrl, dark: verticalDarkUrl },
  isotipo: { light: isotipoUrl, dark: isotipoDarkUrl },
}

// Tamaño mínimo del README §3 expresado en altura (el ancho siempre es automático):
// horizontal ≥ 110 px de ancho → 36 px de alto; vertical ≥ 96 px de ancho → 84 px de alto.
const MIN_HEIGHT = {
  horizontal: 'min-h-9',
  vertical: 'min-h-[84px]',
  isotipo: '',
}

/**
 * Logotipo oficial SOKKO. La altura va en `className` (h-…); el ancho se ajusta solo para no deformarlo.
 * Es solo la imagen: el enlace (si lo hay) lo pone quien lo usa.
 */
export default function Logo({ variant = 'horizontal', tone = 'light', className = '' }) {
  const src = (SOURCES[variant] ?? SOURCES.horizontal)[tone === 'dark' ? 'dark' : 'light']
  return (
    <img
      src={src}
      alt="SOKKO"
      draggable={false}
      decoding="async"
      className={`block w-auto max-w-none select-none ${MIN_HEIGHT[variant] ?? ''} ${className}`}
    />
  )
}
