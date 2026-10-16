# CONTEXTO MAESTRO — SOKKO (ソッコ)

> **"Confort que Renace cada paso"**

Documento de referencia arquitectónica del E-Commerce **SOKKO** para la materia de
**Arquitectura Orientada a Servicios (SOA)**. Toda decisión técnica del proyecto debe
ser coherente con este documento.

---

## 1. Identidad de marca

| Elemento  | Valor                                   |
|-----------|-----------------------------------------|
| Marca     | **SOKKO** (ソッコ)                        |
| Eslogan   | *Confort que Renace cada paso*          |
| Giro      | E-Commerce de calcetines                |
| Estética  | Japonesa minimalista                    |

### 1.1 Paleta de colores

> **Dirección visual aprobada: Kyoto Artisan & Botanical Wabi-Sabi (Propuesta 3).**
> Especificación completa en `docs/design/DESIGN.md`. Sustituye a la paleta Zen original
> (`washi #FAF8F5`, `sumi #1A1A1A`, `aka #D32F2F`).

| Token Tailwind | Hex | Uso |
|---|---|---|
| `linen` | `#F4F0EB` | Fondo base de la página y del drawer |
| `sand` | `#ECE5DC` | Secciones alternas, tarjetas de imagen, top bar |
| `sand-2` | `#E3DACD` | Estados deshabilitados, hover de superficies |
| `ink` | `#23211E` | Texto principal, trazos, bordes al 10–20 % de opacidad |
| `ink-soft` | `#6A645C` | Texto secundario y metadatos |
| `laca` | `#A62B2B` | Acento único: CTA de pago, sello, "pocos ejemplares", énfasis en itálica |
| `laca-hover` | `#8F2424` | Hover del CTA de pago |
| `matcha` | `#5A6654` | Etiquetas de sección (eyebrows), tags de material, estado "agregado" (ajustado para pasar 4.5:1 sobre sand) |
| `moss` | `#8F9779` | **Solo bordes y puntos decorativos.** No usar como color de texto |

Tipografía: **Cormorant Garamond** (`font-serif`, titulares y precios), **Work Sans**
(`font-sans`, cuerpo y botones) y **Shippori Mincho** (`font-jp`, kanji decorativos).

### 1.2 Principios visuales

- **Ma (間)** — espacio negativo generoso; menos elementos, más aire.
- **Kanso (簡素)** — simplicidad; sin ornamentos innecesarios.
- **Wabi-sabi (侘寂)** — texturas de lino, láminas botánicas, belleza de lo imperfecto.
- El rojo `laca` se usa con moderación: solo en los puntos enumerados en DESIGN.md §1.1.
- Esquinas rectas, bordes finos, sin sombras de tarjeta.

---

## 2. Arquitectura general

Monorepo con dos aplicaciones independientes que se comunican vía HTTP/JSON
(arquitectura orientada a servicios).

```
socks-ecommerce-hub/
├── apps/
│   ├── web-store/      → Frontend (consumidor del servicio)
│   └── api-service/    → Backend SOA (proveedor del servicio)
├── docs/               → Documentación del proyecto
├── CONTEXTO_MAESTRO.md
└── README.md
```

```
┌──────────────────────┐   HTTP / JSON (REST)   ┌──────────────────────────┐        ┌──────────────┐
│  web-store           │ ─────────────────────▶ │  api-service             │ ─────▶ │  SQL Server  │
│  React + Vite        │ ◀───────────────────── │  ASP.NET Core Web API    │        │  (futuro)    │
│  localhost:5173      │      CORS AllowWebStore│  Swagger / OpenAPI       │        └──────────────┘
└──────────────────────┘                        └──────────────────────────┘
```

### 2.1 Frontend — `apps/web-store`

- **Stack:** React + Vite + Tailwind CSS.
- **Librerías:** `react-router-dom` (ruteo), `lucide-react` (íconos).
- **Puerto de desarrollo:** `http://localhost:5173`.
- **Estructura de `src/`:**
  - `components/` — componentes reutilizables de UI.
  - `pages/` — vistas asociadas a rutas.
  - `services/` — clientes HTTP hacia `api-service` (única capa que conoce la URL de la API).
  - `context/` — estado global (React Context: carrito, sesión, etc.).
  - `assets/` — imágenes, fuentes y recursos estáticos.
- **Configuración:** la URL de la API se lee de `VITE_API_URL`.

### 2.2 Backend — `apps/api-service`

- **Stack:** ASP.NET Core Web API (controladores), proyecto `Sokko.Api`.
- **Documentación:** Swagger / OpenAPI habilitado en desarrollo.
- **CORS:** política `"AllowWebStore"` que permite `http://localhost:5173`.
- **Estructura:**
  - `Controllers/` — endpoints REST (contratos públicos del servicio).
  - `Models/` — entidades de dominio.
  - `DTOs/` — objetos de transferencia (contrato de entrada/salida, desacoplado del dominio).
  - `Services/` — lógica de negocio (interfaces + implementaciones, inyectadas por DI).
  - `Data/` — acceso a datos (futuro `DbContext` de EF Core).
- **Convención de rutas:** `api/[recurso]` (p. ej. `GET /api/health`).

### 2.3 Base de datos (fase futura)

- **Motor:** SQL Server.
- **Acceso:** Entity Framework Core desde `apps/api-service/Data`.
- **Estado:** *aún no configurada.*

---

## 3. Principios SOA aplicados

1. **Contrato de servicio explícito** — DTOs + OpenAPI definen el contrato.
2. **Bajo acoplamiento** — el frontend solo conoce el contrato HTTP, nunca el modelo interno.
3. **Abstracción** — la lógica vive en `Services/`, los controladores solo orquestan.
4. **Reutilización** — los servicios pueden ser consumidos por otros clientes (móvil, admin).
5. **Autonomía** — cada app se compila, ejecuta y despliega de forma independiente.

---

## 4. Endpoints actuales

| Método | Ruta          | Descripción                                    |
|--------|---------------|------------------------------------------------|
| GET    | `/api/health` | Verifica la comunicación React ↔ .NET          |

Respuesta:

```json
{ "status": "OK", "service": "SOKKO API Service", "message": "Confort que Renace cada paso" }
```

---

## 5. Hoja de ruta

- [x] **Fase 0** — Scaffolding del monorepo, frontend y backend; endpoint de salud.
- [ ] **Fase 1** — Integración con SQL Server (EF Core, migraciones).
- [ ] **Fase 2** — Catálogo de productos (calcetines), detalle, filtros.
- [ ] **Fase 3** — Carrito, checkout y órdenes.
- [ ] **Fase 4** — Autenticación de usuarios y panel de administración.
- [ ] **Fase 5** — Diseño completo de pantallas con la estética SOKKO.
