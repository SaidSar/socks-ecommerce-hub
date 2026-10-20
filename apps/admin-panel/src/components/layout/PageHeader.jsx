/** Encabezado de página: h1 serif (único uso de Cormorant), subtítulo y acciones. */
export default function PageHeader({ title, sub, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="font-serif text-[clamp(28px,3vw,36px)] leading-tight">{title}</h1>
        {sub && <p className="text-[13px] text-ink-soft mt-1">{sub}</p>}
      </div>
      {children}
    </div>
  )
}
