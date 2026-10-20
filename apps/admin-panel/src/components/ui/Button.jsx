const VARIANTS = {
  primary: 'bg-laca hover:bg-laca-hover text-white',
  dark: 'bg-ink hover:bg-black text-linen',
  outline: 'border border-line bg-paper hover:bg-sand text-ink',
  ghost: 'hover:bg-sand text-ink',
}

// En pantallas táctiles (< lg) todos los botones miden al menos 44 px de alto (DESIGN_ADMIN.md §8, Fase 7).
const SIZES = {
  sm: 'h-8 max-lg:h-11 px-3 text-[12.5px]',
  md: 'h-10 max-lg:h-11 px-4 text-[13.5px]',
}

/** Botón del sistema: primary (laca) solo para la acción principal de la vista. */
export default function Button({ variant = 'primary', size = 'md', className = '', type = 'button', children, ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
