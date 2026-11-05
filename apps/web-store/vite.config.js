import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const config = {
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    // Los tests usan el mock aunque exista un .env con VITE_API_URL.
    env: { VITE_USE_MOCKS: 'true' },
    include: ['src/**/*.test.{js,jsx}'],
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `--mode mocks` (build:mocks, pruebas e2e): datos simulados aunque exista un .env.local con la API.
  // Las variables del proceso tienen prioridad sobre los archivos .env.
  if (mode === 'mocks') process.env.VITE_USE_MOCKS = 'true'
  return config
})
