import { defineConfig } from '@playwright/test'

// Verificaciones en navegador real (npm run test:e2e). Usa el Chrome instalado en la máquina (sin descargar navegadores)
// y la build de producción servida con `vite preview`, en modo mock para no depender de la API.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4175',
    channel: 'chrome',
    headless: true,
  },
  webServer: {
    command: 'npm run build:mocks && npx vite preview --outDir dist-e2e --port 4175 --strictPort',
    url: 'http://localhost:4175',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
