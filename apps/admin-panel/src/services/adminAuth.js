// Acceso simulado al panel (DESIGN_ADMIN.md §4). Única capa que hablará con /api/admin/auth/*.
// TODO(api): POST /api/admin/auth/login y GET /api/admin/auth/me; el token lo emite el servidor.

export const SESSION_KEY = 'sokko.admin.session.v1'

// TODO(api): el hash vive solo en el servidor. SHA-256 de las contraseñas demo.
const USERS = [
  { id: 'u-aiko', name: 'Aiko Morales', email: 'hola@sokko.mx', role: 'dueno', hash: '9733028d4e7e2b1601a0f0df6df8e0e944d6f7759528ea8da62ae0ae8da1a259' },
  { id: 'u-daniel', name: 'Daniel Ruiz', email: 'daniel@sokko.mx', role: 'operaciones', hash: '4f42ff63748ce568d6b18856d9818700494ac522945ec4236b798b4e1b3772fe' },
  { id: 'u-kevin', name: 'Kevin Armenta', email: 'kevin@sokko.mx', role: 'operaciones', hash: '4f42ff63748ce568d6b18856d9818700494ac522945ec4236b798b4e1b3772fe' },
]

// Solo se muestran en import.meta.env.DEV (pantalla de acceso y README).
export const DEMO_ACCOUNTS = [
  { role: 'Dueño', name: 'Aiko Morales', email: 'hola@sokko.mx', password: 'Kyoto2026' },
  { role: 'Operaciones', name: 'Daniel Ruiz', email: 'daniel@sokko.mx', password: 'Operaciones2026' },
  { role: 'Operaciones', name: 'Kevin Armenta', email: 'kevin@sokko.mx', password: 'Operaciones2026' },
]

export class AuthError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()
const latency = () => new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : 500 + Math.random() * 300))

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Usuario público: nunca incluye el hash. */
const toPublic = ({ id, name, email, role }) => ({ id, name, email, role })

/** Iniciales + apellido corto para bitácoras: "Aiko Morales" → "Aiko M." */
export const shortName = (name) => {
  const [first, last = ''] = String(name).split(' ')
  return last ? `${first} ${last[0]}.` : first
}

/** Lista de usuarios internos (solo lectura en Configuración). TODO(api): GET /api/admin/users */
export const listUsers = () => USERS.map(toPublic)

export async function login(email, password) {
  await latency()
  const user = USERS.find((u) => u.email === normalizeEmail(email))
  const hash = await sha256(String(password ?? ''))
  // Mismo mensaje para correo inexistente o contraseña incorrecta.
  if (!user || user.hash !== hash) throw new AuthError('INVALID_CREDENTIALS')
  const session = { user: toPublic(user), startedAt: new Date().toISOString() }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* sin almacenamiento: la sesión vive solo en memoria */
  }
  return session.user
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { user } = JSON.parse(raw)
    // Solo se aceptan usuarios que existen y con su rol vigente.
    const known = USERS.find((u) => u.id === user?.id)
    return known ? toPublic(known) : null
  } catch {
    return null
  }
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* nada que limpiar */
  }
}
