import { createContext } from 'react'
import { DEFAULT_CONFIG } from '../config/commerce'

// Objeto de contexto separado del provider para que Fast Refresh funcione (react/only-export-components).
// El valor por defecto permite renderizar con la configuración de respaldo aunque falte el provider.
export const ConfigContext = createContext(DEFAULT_CONFIG)
