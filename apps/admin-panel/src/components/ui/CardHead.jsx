/** Encabezado de tarjeta: título, subtítulo opcional y acciones a la derecha. */
export default function CardHead({ title, sub, right, id }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[14.5px] font-semibold">
          {title}
        </h2>
        {sub && <p className="text-[12.5px] text-ink-soft mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  )
}
