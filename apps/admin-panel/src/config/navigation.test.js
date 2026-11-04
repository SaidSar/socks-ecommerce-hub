import { describe, expect, it } from 'vitest'
import { NAV, navForPath, pageTitle } from './navigation'
import { can, PERMISSIONS } from './roles'

const visible = (role) => NAV.filter((n) => can(role, n.perm)).map((n) => n.key)

describe('navegación por rol', () => {
  it('el Dueño ve Clientes, Reportes y Mensajes', () => {
    expect(visible('dueno')).toEqual(expect.arrayContaining(['clientes', 'finanzas', 'mensajes']))
  })

  it('Operaciones ve Mensajes pero no Clientes ni Reportes (sin pesos)', () => {
    const ops = visible('operaciones')
    expect(ops).toContain('mensajes')
    expect(ops).not.toContain('clientes')
    expect(ops).not.toContain('finanzas')
  })

  it('las tres secciones ya están construidas y Reportes vive en /reportes', () => {
    for (const key of ['clientes', 'finanzas', 'mensajes']) expect(NAV.find((n) => n.key === key).ready).toBe(true)
    expect(NAV.find((n) => n.key === 'finanzas')).toMatchObject({ label: 'Reportes', to: '/reportes', perm: 'finance.view' })
  })

  it('Mensajes va entre Envíos y Promociones, con ícono de sobre', () => {
    const keys = NAV.map((n) => n.key)
    expect(keys.indexOf('mensajes')).toBe(keys.indexOf('envios') + 1)
    expect(keys.indexOf('promociones')).toBe(keys.indexOf('mensajes') + 1)
    expect(NAV.find((n) => n.key === 'mensajes')).toMatchObject({ icon: 'mail', perm: 'messages.view' })
  })

  it('mismos permisos que Services/Permissions.cs', () => {
    expect(PERMISSIONS).toHaveLength(17)
    expect(PERMISSIONS).toContain('messages.view')
  })
})

describe('título de la página', () => {
  it('sale de la sección de la ruta', () => {
    expect(navForPath('/')?.key).toBe('dashboard')
    expect(navForPath('/pedidos/SKK-1042')?.key).toBe('pedidos')
    expect(navForPath('/reportes')?.label).toBe('Reportes')
    expect(navForPath('/catalogo/marcas')?.key).toBe('marcas')
    expect(navForPath('/no-existe')).toBeUndefined()
    expect(pageTitle('Clientes')).toBe('Clientes · SOKKO Panel')
  })
})
