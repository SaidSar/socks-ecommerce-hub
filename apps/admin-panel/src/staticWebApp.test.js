import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8'))
const csp = config.globalHeaders['Content-Security-Policy']

describe('staticwebapp.config.json', () => {
  it('las rutas de React caen en index.html, pero no los archivos', () => {
    expect(config.navigationFallback.rewrite).toBe('/index.html')
    expect(config.navigationFallback.exclude).toContain('/assets/*')
  })

  it('lleva los encabezados de seguridad', () => {
    expect(config.globalHeaders['X-Content-Type-Options']).toBe('nosniff')
    expect(config.globalHeaders['Referrer-Policy']).toBeTruthy()
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('la CSP no abre scripts y solo conecta con la API del build', () => {
    expect(csp).toContain("script-src 'self';")
    expect(csp).toContain("connect-src 'self' __API_ORIGIN__;")
    expect(csp).not.toMatch(/\*/)
  })
})
