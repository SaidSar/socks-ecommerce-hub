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
})
