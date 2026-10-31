import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
  test: {
    environment: 'node',
    // Los tests usan el mock aunque exista un .env con VITE_API_URL.
    env: { VITE_USE_MOCKS: 'true' },
    include: ['src/**/*.test.js'],
  },
})
