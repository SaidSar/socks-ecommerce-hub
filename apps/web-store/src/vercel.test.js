import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
const headers = Object.fromEntries(config.headers[0].headers.map((h) => [h.key, h.value]))

describe('vercel.json', () => {
  it('todas las rutas de React caen en index.html', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('lleva los encabezados de seguridad y la CSP no abre scripts', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBeTruthy()
    expect(headers['Content-Security-Policy']).toContain("script-src 'self';")
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
  })

  it('las fotos y la API salen de sus orígenes exactos, sin comodines', () => {
    const csp = Object.fromEntries(headers['Content-Security-Policy'].split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]))
    expect(csp['img-src']).toEqual(["'self'", 'data:', 'https://stsokkoqifdnnh6tfjpc.blob.core.windows.net'])
    expect(csp['connect-src']).toEqual(["'self'", 'https://app-sokko-qifdnnh6tfjpc.azurewebsites.net'])
    expect(headers['Content-Security-Policy']).not.toContain('*')
  })
})
