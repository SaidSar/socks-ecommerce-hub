# DESIGN_AUTH.md — Acceso de cuenta "Kyoto Biombo" · SOKKO (ソッコ)

> **Propósito:** especificación ejecutable para que Claude Code implemente el acceso de cuenta (iniciar sesión, crear cuenta, recuperar contraseña y bienvenida) en `apps/web-store`, más el acceso desde el Navbar del Home.
> **Referencia visual:** `docs/design/mockups/auth-kyoto.html` (fuente de verdad visual y de copy).
> **Hereda de:** `docs/design/DESIGN.md` (tokens, tipografías, reglas de forma y accesibilidad). Este documento **no redefine tokens**: reutiliza los de `apps/web-store/src/index.css` (`@theme`).
> **Alcance:** solo frontend. **No hay backend todavía**: la autenticación es simulada detrás de `services/authService.js` y queda lista para conectarse a la API.

---

## 0. Instrucciones para Claude Code

1. Lee `CONTEXTO_MAESTRO.md`, `docs/design/DESIGN.md`, este archivo y `docs/design/mockups/auth-kyoto.html` antes de escribir código.
2. Rama: `said/frontend-login` creada desde `main` actualizado. Un commit por fase (§6) con formato `feat(web-store): auth fase N — <resumen>`.
3. Al terminar cada fase: `npm run build` y `npm run lint` sin errores ni warnings; marca sus casillas aquí.
4. Reutiliza componentes y utilidades existentes (`Logo`, `KnitTabi`, `useLockBodyScroll`, `scrollToId`, tokens). No dupliques.
5. Nada de `Math.random()` para IDs SVG (`useId()`), nada de Tailwind/Babel por CDN, nada de librerías de UI ni de formularios externas.
6. Ante una duda de diseño, replica el mockup y deja `// TODO(design):`. Todo punto de integración con API lleva `// TODO(api):`.

---

## 1. Rutas

| Ruta | Vista | Notas |
|---|---|---|
| `/cuenta` | Iniciar sesión | Pestaña activa "Iniciar sesión" |
| `/cuenta/registro` | Crear cuenta | Pestaña activa "Crear cuenta" |
| `/cuenta/recuperar` | Restablecer contraseña | Sin pestañas; eyebrow "Recuperar acceso" |
| `/cuenta/bienvenida` | Bienvenida | Solo accesible con sesión; si no hay sesión, redirige a `/cuenta` |

- Las pestañas cambian de ruta con `navigate` (historial del navegador funcional).
- Si hay sesión activa y el usuario entra a `/cuenta` o `/cuenta/registro`, redirige a `/cuenta/bienvenida`.
- Soporta `?redirect=/ruta`: tras login o registro exitoso navega a esa ruta en lugar de la bienvenida (solo rutas internas que empiecen con `/`).
- La página de cuenta **no** muestra TopBar, Navbar ni Footer del Home: es una pantalla completa con su propio enlace "← Volver a la tienda" (`/`) y su pie legal.
- `document.title`: "Iniciar sesión · SOKKO", "Crear cuenta · SOKKO", "Restablecer contraseña · SOKKO", "Bienvenida · SOKKO".

---

## 2. Composición (biombo de dos hojas)

```text
AuthLayout  grid lg:[5fr_6fr], min-h-screen
├── AuthEditorialPanel (aside, bg-sand linen-tex)
│   ├── Logo → "/"
│   ├── kanji de fondo por vista: 入 login · 新 registro · 鍵 recuperar · 迎 bienvenida (ink/5 %, aria-hidden)
│   ├── eyebrow + titular serif por vista (ver §4.1)
│   ├── tarjeta con sol laca + KnitTabi en tono por vista
│   ├── lista "01–03" de beneficios (solo lg)
│   └── cita "“Cada par tejido con respeto al pie.”" (solo lg)
└── main (linen-tex)
    ├── barra: "← Volver a la tienda" · "Envío de cortesía desde $799 MXN" (sm+)
    ├── AuthTabs (login/registro) | eyebrow + h1 (recuperar)
    ├── LoginForm | RegisterForm | ForgotForm | Welcome
    ├── "¿Prefiere no crear cuenta ahora? · Comprar como invitado" (login/registro)
    └── pie: Aviso de privacidad · Términos · © 2026 SOKKO ソッコ · NEXUS CODE · UAdeO
```

- Columna de formulario: `max-w-[460px]`, alineada a la izquierda en `lg`, centrada en móvil.
- En móvil el panel editorial es una franja superior: logo, eyebrow, titular y la tarjeta pequeña a la derecha (`w-[110px] sm:w-[150px]`); sin lista de beneficios.
- Tono de la calceta por vista: login `#2C2925` · registro `#EFE8DC` · recuperar `#6E7A5E` · bienvenida `#9E2F2C` (usar `TONES` de `catalog.mock.js` donde coincida).

---

## 3. Navbar del Home — acceso a cuenta (cambio en componente existente)

Archivo: `src/components/layout/Navbar.jsx`. Orden a la derecha: **buscar · cuenta · bolsa (n)**.

**Sin sesión**
- Botón-enlace con ícono de persona (trazo 1.1, mismo estilo que la bolsa, 22 px) → `/cuenta`.
- `aria-label="Iniciar sesión o crear cuenta"`. En `md+` muestra a la derecha el texto `Entrar` en `text-[13px] tracking-[.12em] uppercase text-inks`; en móvil solo ícono. Área táctil ≥ 44 × 44 px.

**Con sesión**
- El ícono se reemplaza por un círculo de 30 px con borde `ink/20`, fondo `sand` y las **iniciales** del usuario en `serif text-[13px]`. Un punto `laca` de 6 px en la esquina superior derecha indica sesión activa.
- Al hacer clic abre un **menú desplegable** (`role="menu"`, botón con `aria-haspopup="menu"` y `aria-expanded`), anclado a la derecha, fondo `linen`, borde `ink/10`, sin sombra fuerte:
  1. Encabezado no interactivo: "Hola, {nombre}" (serif 18 px) + correo (12 px `ink-soft`).
  2. `Mi carnet` → `/cuenta/bienvenida`.
  3. `Mis pedidos` → deshabilitado con etiqueta "Próximamente" (`// TODO(api)`).
  4. Separador.
  5. `Cerrar sesión` → `logout()` y permanece en la página actual.
- Cierra con `Esc`, clic fuera y al elegir una opción; navegación con flechas ↑/↓ entre `menuitem`.
- En el menú móvil del Navbar agrega una fila al final: "Iniciar sesión" o "Hola, {nombre} · Cerrar sesión".

**Integración con el catálogo**
- `PieceCard` preselecciona `user.preferredSize` si existe; si no, `'M'`. El hero no tiene selector de talla, así que no aplica.

---

## 4. Vistas y copy (exacto, tomado del mockup)

### 4.1 Panel editorial por vista

| Vista | Eyebrow | Titular (itálica entre `*`) |
|---|---|---|
| login | Regresar al atelier | Sus pasos *le esperan*. |
| registro | Unirse al atelier | Una cuenta, *un ritmo propio*. |
| recuperar | Recuperar acceso | Un nuevo *comienzo*. |
| bienvenida | Bienvenida | El atelier *es suyo*. |

Beneficios: 01 Su talla guardada — Cada pieza aparece ya en S, M o L según su pie. · 02 Ediciones limitadas primero — Aviso 48 horas antes de que un tiraje numerado salga a la venta. · 03 Historial y cambios — Sus pedidos, guías de rastreo y cambios en 30 días, en un solo lugar.

### 4.2 Iniciar sesión
- Campos: Correo electrónico (`type=email`, `autoComplete=email`, placeholder `nombre@dominio.com`) · Contraseña (`autoComplete=current-password`, botón mostrar/ocultar con `aria-pressed`).
- "Mantener la sesión" (checkbox, marcado por defecto) y enlace en itálica "¿Olvidó su contraseña?" → `/cuenta/recuperar`.
- Botón: "Iniciar sesión" · cargando: "Verificando…" (spinner).
- Mientras carga no se deshabilita (conserva el foco): usa `aria-busy="true"` e ignora clics repetidos.
- Pie: "¿Primera visita al atelier? Crear una cuenta".
- Bloque demo (solo `import.meta.env.DEV`): "Demo · correo hola@sokko.mx · contraseña Kyoto2026".

### 4.3 Crear cuenta
- Nombre (`given-name`) y Apellido (`family-name`) en dos columnas desde `sm`.
- Correo con hint "Aquí recibirá la confirmación de sus pedidos."
- Contraseña (`new-password`) con **medidor de pincelada** (`PasswordStrength`) y lista de reglas; Confirmar contraseña.
- Fieldset "Su talla habitual (opcional)" con S/M/L (22–24 · 25–27 · 28–30 cm); clic sobre la seleccionada la deselecciona. Hint: "La preseleccionaremos en cada pieza del atelier."
- Checkbox ediciones limitadas (marcado por defecto): "Quiero enterarme de las ediciones limitadas antes de su lanzamiento. Un correo al mes, como máximo."
- Checkbox términos (obligatorio) con enlaces a `#terminos` y `#privacidad` (`// TODO(design)` hasta tener rutas legales).
- Botón: "Crear mi cuenta" · cargando: "Creando su cuenta…".
- Pie: "¿Ya tiene cuenta? Iniciar sesión".

### 4.4 Restablecer contraseña
- Texto: "Escriba el correo de su cuenta y le enviaremos un enlace para crear una contraseña nueva."
- Botón "Enviar enlace" · cargando "Enviando…". Enlace "← Volver a iniciar sesión".
- Confirmación (siempre igual, **exista o no la cuenta**): kanji 便 decorativo, "Revise su correo", "Si {correo} tiene una cuenta, le enviamos un enlace para crear una contraseña nueva. El enlace dura 30 minutos.", nota de spam, botones "Volver a iniciar sesión" y "Usar otro correo".

### 4.5 Bienvenida
- Sello cuadrado 96 px borde `laca` 2 px con 歓迎 (cuenta nueva) u お帰 (regreso), animación `stamp`.
- Eyebrow: "Cuenta creada" / "Sesión iniciada".
- Titular: "Le damos la bienvenida, *{nombre}*." / "Qué gusto verle de nuevo, *{nombre}*."
- Texto: registro → "Enviamos un correo a {correo} para confirmar su cuenta. Guardamos su talla {S|M|L} para preseleccionarla en el atelier." (segunda frase solo si eligió talla). Login → "Su bolsa y sus pedidos están donde los dejó."
- Tres datos: pedidos (`0`, `// TODO(api)`) · talla guardada (`—` si no hay) · pares en su bolsa (**real**, desde `useCart().count`).
- Botones: "Volver al atelier" → `/` · "Cerrar sesión" → `logout()` y `/cuenta`.
- Si el usuario llega a la bienvenida sin venir de login/registro (desde "Mi carnet"), usa el modo login.

---

## 5. Reglas y datos (sin backend)

### 5.1 Validación (mensajes exactos)

| Caso | Mensaje |
|---|---|
| Correo vacío | Escriba su correo electrónico. |
| Correo con formato inválido (`/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`) | Revise el formato del correo, por ejemplo nombre@dominio.com. |
| Contraseña vacía (login) | Escriba su contraseña. |
| Credenciales incorrectas (alerta general) | El correo o la contraseña no coinciden. Revise ambos o restablezca su contraseña. |
| Nombre / Apellido vacío | Escriba su nombre. / Escriba su apellido. |
| Correo ya registrado | Este correo ya tiene una cuenta. Inicie sesión o use otro correo. |
| Contraseña débil | La contraseña necesita 8 caracteres, mayúsculas, minúsculas y un número. |
| Confirmación vacía / distinta | Repita la contraseña. / Las contraseñas no coinciden. |
| Términos sin aceptar | Para crear la cuenta debe aceptar los términos y el aviso de privacidad. |
| Más de un error en registro (alerta) | Hay {n} campos por revisar. |

- Validar formato de correo en `onBlur` y al enviar; el resto al enviar. Al editar un campo se limpia su error.
- Al fallar el envío: animación `shake` del formulario y foco al primer campo con error.
- Campos con `aria-invalid` y `aria-describedby` hacia su error/hint; alertas generales con `role="alert"`.

### 5.2 Fuerza de contraseña
Reglas: ≥ 8 caracteres · mayúsculas y minúsculas · al menos un número · un símbolo (opcional). Válida = primeras tres. Puntaje 0–4 → etiqueta Débil (0–1), Aceptable (2), Buena (3), Excelente (4). Color del trazo: `laca` (≤1), token `ocre` `#B07A3C` (2, solo para el trazo; la etiqueta va en `ink-soft`), `matcha` (≥3). Longitud del trazo con `getTotalLength()`.

### 5.3 `src/services/authService.js` (simulado)
API pública (todas `async`, latencia simulada 900–1300 ms):

```txt
login({ email, password, remember }) → { user } | throw AuthError('INVALID_CREDENTIALS')
register({ firstName, lastName, email, password, preferredSize, marketingOptIn }) → { user } | throw AuthError('EMAIL_TAKEN')
requestPasswordReset(email) → void   (siempre resuelve; no revela si existe)
logout() → void
getSession() → user | null
```

- `user = { id, firstName, lastName, email, preferredSize, marketingOptIn, memberSince }` (nunca incluye contraseña).
- Usuarios simulados en `localStorage` `sokko.users.v1`, sembrado con la cuenta demo `hola@sokko.mx` / `Kyoto2026` (Aiko Morales, talla M) y `nexus@sokko.mx` como correo ocupado.
- Las contraseñas del mock se guardan **hasheadas** con `crypto.subtle.digest('SHA-256')` (hex). Comentario obligatorio: `// TODO(api): mock local; en producción el hash vive solo en el servidor (POST /api/auth/*)`.
- Sesión: `remember = true` → `localStorage` `sokko.session.v1`; `false` → `sessionStorage`. Todo acceso a storage dentro de `try/catch`.
- Correos se comparan normalizados (`trim().toLowerCase()`).

### 5.4 `src/context/AuthContext.jsx` + `src/hooks/useAuth.js`
- Estado: `user`, `status: 'idle' | 'loading'`. Hidrata con `getSession()` al montar.
- Acciones: `login`, `register`, `logout`, `requestPasswordReset` (delegan en el servicio).
- Derivados: `isAuthenticated`, `initials` (primera letra de nombre + apellido).
- `useAuth()` lanza error claro fuera del provider. `<AuthProvider>` envuelve la app junto a `<CartProvider>`.

---

## 6. Plan por fases

### Fase 1 — Servicio y contexto
- [x] `services/authService.js`, `context/AuthContext.jsx`, `hooks/useAuth.js` (§5.3–5.4) y provider en `App.jsx`.
- **Criterio:** en consola del navegador (dev), login demo devuelve el usuario sin contraseña; registrar `hola@sokko.mx` lanza `EMAIL_TAKEN`.

### Fase 2 — Rutas y layout
- [x] Rutas de §1 en `App.jsx` con `pages/Account.jsx` (o `pages/auth/*`) y guardas de redirección.
- [x] `components/auth/AuthLayout.jsx`, `AuthEditorialPanel.jsx`, `AuthTabs.jsx` (`role=tablist`, subrayado `laca` animado de 64 px).
- **Criterio:** las 4 rutas renderizan el biombo con el panel correcto; `/cuenta/bienvenida` sin sesión redirige a `/cuenta`.

### Fase 3 — Formularios
- [x] `components/auth/AuthField.jsx`, `PasswordField.jsx`, `PasswordStrength.jsx`, `LoginForm.jsx`, `RegisterForm.jsx`, `ForgotForm.jsx` con validaciones y copy de §4–5.
- **Criterio:** todos los mensajes de §5.1 aparecen en su caso; el foco va al primer error.

### Fase 4 — Bienvenida y Navbar
- [x] `components/auth/Welcome.jsx` (§4.5) con pares en bolsa reales.
- [x] Navbar: ícono de cuenta, estado con iniciales y menú (§3); fila en menú móvil.
- [x] Preselección de talla desde `user.preferredSize` en `PieceCard` y hero.
- **Criterio:** login demo → bienvenida "お帰" → "Volver al atelier" muestra iniciales "AM" en el Navbar y talla M preseleccionada; "Cerrar sesión" vuelve al ícono.

### Fase 5 — Accesibilidad, responsive y pulido
- [x] Áreas táctiles ≥ 44 px; `prefers-reduced-motion` sin shake, sello ni pincelada animada.
- [x] Breakpoints 360, 390, 768, 1024, 1280, 1440 sin scroll horizontal.
- [x] Lighthouse móvil Accesibilidad = 100 en `/cuenta` y `/cuenta/registro`.
- [x] Capturas en `docs/design/screenshots/`: `auth-login-1440.png`, `auth-registro-390.png`, `auth-bienvenida-1440.png`, `home-navbar-sesion-1440.png`.

---

## 7. Casos de verificación manual

1. `hola@sokko.mx` + `Kyoto2026` → Bienvenida "Qué gusto verle de nuevo, Aiko." con sello お帰; Navbar muestra "AM".
2. `hola@sokko.mx` + contraseña errónea → alerta de credenciales, sin revelar cuál campo falló.
3. Registro con `nexus@sokko.mx` → "Este correo ya tiene una cuenta…".
4. Registro válido con talla L → Bienvenida 歓迎 con texto de talla L; en el Home las tarjetas preseleccionan L; recargar la página mantiene la sesión.
5. Login con "Mantener la sesión" desmarcado → cerrar la pestaña y abrir de nuevo pide iniciar sesión.
6. Recuperar con un correo inexistente → misma confirmación que con uno existente.
7. `/cuenta?redirect=/` tras login exitoso → vuelve al Home, no a la bienvenida.

---

## 8. Contrato esperado de la API (siguiente iteración, no implementar)

| Acción | Endpoint | Respuesta |
|---|---|---|
| Login | `POST /api/auth/login` `{ email, password }` | `200 { accessToken, expiresIn, user }` · `401` |
| Registro | `POST /api/auth/register` `{ firstName, lastName, email, password, preferredSize?, marketingOptIn, acceptedTerms }` | `201 { accessToken, user }` · `409` |
| Olvidé contraseña | `POST /api/auth/forgot-password` `{ email }` | `202` siempre |
| Restablecer | `POST /api/auth/reset-password` `{ token, newPassword }` | `204` · `400` |
| Sesión actual | `GET /api/auth/me` (Bearer) | `200 { user }` · `401` |

BD: `Users(Id, FirstName, LastName, Email UNIQUE, PasswordHash, PreferredSize NULL, MarketingOptIn BIT, AcceptedTermsAt, EmailConfirmedAt NULL, MemberSince/CreatedAt)` y `PasswordResetTokens(Id, UserId FK, TokenHash, ExpiresAt, UsedAt NULL)`.
Clasificación SOA: hash/JWT = **servicio de utilidad**; `Users` = **servicio de entidad**.

---

## 9. Definición de terminado
- [x] Fases 1–5 con casillas marcadas y los 7 casos de §7 verificados.
- [x] `npm run build` y `npm run lint` limpios en la rama.
- [x] PR `said/frontend-login` → `main` abierto con capturas enlazadas desde `blob/said/frontend-login/...` (se corrigen a `blob/main/` después del merge).
