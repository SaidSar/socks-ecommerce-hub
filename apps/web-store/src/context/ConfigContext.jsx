import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG } from '../config/commerce'
import { getConfig } from '../services/configService'
import { ConfigContext } from './config-context'

/** Carga GET /api/config una vez; mientras tanto (o si falla) usa los valores de respaldo. */
export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    let alive = true
    getConfig()
      .then((data) => alive && setConfig({ ...DEFAULT_CONFIG, ...data }))
      .catch(() => {
        /* sin API: se queda la configuración de respaldo */
      })
    return () => {
      alive = false
    }
  }, [])

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}
