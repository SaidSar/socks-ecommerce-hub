import Icon from './Icon'

/** Campo de búsqueda con ícono; la etiqueta es solo para lectores de pantalla. */
export default function SearchField({ id, value, onChange, placeholder, label, className = '' }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 h-9 max-lg:h-11 px-3 rounded-md border border-line bg-paper focus-within:border-ai w-full sm:w-64 ${className}`}
    >
      <Icon name="search" className="w-4 h-4 text-ink-soft" />
      <span className="sr-only">{label ?? placeholder}</span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent outline-none w-full min-w-0 text-[13px] placeholder:text-ink-soft"
      />
    </label>
  )
}
