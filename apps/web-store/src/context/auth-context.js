import { createContext } from 'react'

// Objeto de contexto separado del provider para que Fast Refresh funcione (react/only-export-components).
export const AuthContext = createContext(null)
