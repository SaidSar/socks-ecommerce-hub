// Autenticación simulada (DESIGN_AUTH.md §5.3). Única capa que sabrá hablar con /api/auth/* cuando exista;
// hoy guarda usuarios en localStorage para que el flujo completo se pueda revisar sin backend.
// TODO(api): reemplazar cada función por fetch(`${API_URL}/api/auth/...`) según el contrato de DESIGN_AUTH.md §8.

const USERS_KEY = 'sokko.users.v1'
export const SESSION_KEY = 'sokko.session.v1'

export const DEMO_ACCOUNT = { email: 'hola@sokko.mx', password: 'Kyoto2026' }

const SEED = [
  {
    id: 'u-demo',
    firstName: 'Aiko',
    lastName: 'Morales',
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
    preferredSize: 'M',
    marketingOptIn: true,
    memberSince: '2026-03-21T00:00:00.000Z',
  },
  {
    id: 'u-nexus',
    firstName: 'Nexus',
    lastName: 'Code',
    email: 'nexus@sokko.mx',
    password: 'NexusCode2026',
    preferredSize: null,
    marketingOptIn: false,
    memberSince: '2026-01-15T00:00:00.000Z',
  },
]

export class AuthError extends Error {
  /** @param {'INVALID_CREDENTIALS' | 'EMAIL_TAKEN'} code */
  constructor(code) {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

// Latencia simulada de red: 900–1300 ms.
const latency = () => new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 400))

// TODO(api): mock local; en producción el hash vive solo en el servidor (POST /api/auth/*)
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Usuario público: nunca incluye la contraseña ni su hash. */
function toPublicUser({ id, firstName, lastName, email, preferredSize, marketingOptIn, memberSince }) {
  return { id, firstName, lastName, email, preferredSize: preferredSize ?? null, marketingOptIn, memberSince }
}

// --- Almacenamiento (todo acceso dentro de try/catch; si falla, se trabaja en memoria) ---

let memoryUsers = null

function readJSON(storage, key) {
  try {
    const raw = window[storage].getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJSON(storage, key, value) {
  try {
    window[storage].setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible */
  }
}

function removeKey(storage, key) {
  try {
    window[storage].removeItem(key)
  } catch {
    /* almacenamiento no disponible */
  }
}

async function loadUsers() {
  const stored = readJSON('localStorage', USERS_KEY)
  if (Array.isArray(stored)) return stored
  if (memoryUsers) return memoryUsers
  const seeded = await Promise.all(
    SEED.map(async ({ password, ...user }) => ({ ...user, passwordHash: await hashPassword(password) })),
  )
  saveUsers(seeded)
  return seeded
}

function saveUsers(users) {
  memoryUsers = users
  writeJSON('localStorage', USERS_KEY, users)
}

function saveSession(user, remember) {
  // remember → sobrevive al cierre del navegador; si no, solo dura la pestaña.
  removeKey(remember ? 'sessionStorage' : 'localStorage', SESSION_KEY)
  writeJSON(remember ? 'localStorage' : 'sessionStorage', SESSION_KEY, user)
}

// --- API pública ---

/** @returns {Promise<{ user: object }>} */
export async function login({ email, password, remember = true }) {
  await latency()
  const users = await loadUsers()
  const found = users.find((u) => u.email === normalizeEmail(email))
  const hash = await hashPassword(String(password ?? ''))
  if (!found || found.passwordHash !== hash) throw new AuthError('INVALID_CREDENTIALS')
  const user = toPublicUser(found)
  saveSession(user, remember)
  return { user }
}

/** @returns {Promise<{ user: object }>} */
export async function register({ firstName, lastName, email, password, preferredSize = null, marketingOptIn = false }) {
  await latency()
  const users = await loadUsers()
  const normalized = normalizeEmail(email)
  if (users.some((u) => u.email === normalized)) throw new AuthError('EMAIL_TAKEN')
  const record = {
    id: `u-${crypto.randomUUID()}`,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: normalized,
    passwordHash: await hashPassword(password),
    preferredSize: preferredSize || null,
    marketingOptIn: Boolean(marketingOptIn),
    memberSince: new Date().toISOString(),
  }
  saveUsers([...users, record])
  const user = toPublicUser(record)
  saveSession(user, true)
  return { user }
}

/** Siempre resuelve igual, exista o no la cuenta, para no revelar qué correos están registrados. */
// TODO(api): POST /api/auth/forgot-password { email } → 202 siempre.
// eslint-disable-next-line no-unused-vars
export async function requestPasswordReset(email) {
  await latency()
}

export async function logout() {
  removeKey('localStorage', SESSION_KEY)
  removeKey('sessionStorage', SESSION_KEY)
}

/** Sesión guardada (síncrono para hidratar sin parpadeo). @returns {object | null} */
export function getSession() {
  const user = readJSON('localStorage', SESSION_KEY) ?? readJSON('sessionStorage', SESSION_KEY)
  return user && typeof user.email === 'string' ? user : null
}
