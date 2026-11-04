import { useContext, useEffect } from 'react'
import { ActiveLineContext } from '../context/active-line-context'

/** Línea marcada en el encabezado además de la de /linea/:line. */
export const useActiveLineValue = () => useContext(ActiveLineContext).line

/** La vista declara su línea mientras está montada (la ficha de producto: "Inicio / Línea / Producto"). */
export function useActiveLine(line) {
  const { setLine } = useContext(ActiveLineContext)
  useEffect(() => {
    setLine(line ?? null)
    return () => setLine(null)
  }, [line, setLine])
}
