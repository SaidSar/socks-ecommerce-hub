import { createContext } from 'react'

// Línea que la vista actual declara como suya (la ficha de un producto), para marcarla en el encabezado.
// Objeto de contexto separado del provider para que Fast Refresh funcione (react/only-export-components).
export const ActiveLineContext = createContext({ line: null, setLine: () => {} })
