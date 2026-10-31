import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/** La CSP de Static Web Apps solo deja conectar con la API de este build (VITE_API_URL). */
function staticWebAppCsp() {
  let url
  return {
    name: 'static-web-app-csp',
    apply: 'build',
    configResolved(config) {
      url = config.env.VITE_API_URL
    },
    closeBundle() {
      const file = resolve('dist/staticwebapp.config.json')
      const origin = url ? new URL(url).origin : ''
      writeFileSync(file, readFileSync(file, 'utf8').replace(' __API_ORIGIN__', origin ? ` ${origin}` : ''))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), staticWebAppCsp()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    // Los tests usan el mock aunque exista un .env con VITE_API_URL.
    env: { VITE_USE_MOCKS: 'true' },
    include: ['src/**/*.test.js'],
  },
})
