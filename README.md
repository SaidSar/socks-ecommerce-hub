<div align="center">

# SOKKO（ソッコ）

### *Confort que Renace cada paso*

E-Commerce de calcetines con estética japonesa minimalista,
construido con una **Arquitectura Orientada a Servicios (SOA)**.

![React](https://img.shields.io/badge/React-Vite-1A1A1A?style=flat-square&logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-1A1A1A?style=flat-square&logo=tailwindcss)
![.NET](https://img.shields.io/badge/ASP.NET_Core-Web_API-D32F2F?style=flat-square&logo=dotnet)

</div>

---

## Arquitectura del monorepo

```
socks-ecommerce-hub/
├── apps/
│   ├── web-store/          # Tienda · React + Vite + Tailwind CSS
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── services/   # Clientes HTTP hacia api-service
│   │       ├── context/
│   │       └── assets/
│   ├── admin-panel/        # Panel administrativo · React + Vite + Tailwind CSS
│   └── api-service/        # Backend SOA · ASP.NET Core Web API (Sokko.Api)
│       ├── Controllers/
│       ├── Models/
│       ├── DTOs/
│       ├── Services/
│       └── Data/
├── docs/                   # Documentación
├── CONTEXTO_MAESTRO.md     # Especificación arquitectónica
└── README.md
```

```
 web-store (React)    ──HTTP/JSON──▶  api-service (.NET)  ──▶  SQL Server (próximamente)
 localhost:5173                       localhost:5080
 admin-panel (React)  ──HTTP/JSON──▶  /api/admin/*
 localhost:5174
```

## Paleta — Kyoto Artisan

| `linen` | `sand` | `ink` | `ink-soft` | `laca` | `matcha` | `moss` |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `#F4F0EB` | `#ECE5DC` | `#23211E` | `#6A645C` | `#A62B2B` | `#5A6654` | `#8F9779` |

Especificación de diseño completa en [`docs/design/DESIGN.md`](docs/design/DESIGN.md).

## Requisitos

- [Node.js](https://nodejs.org/) 20+ y npm
- [.NET SDK](https://dotnet.microsoft.com/download) 10+

## Puesta en marcha

### 1. Backend — `api-service`

```bash
cd apps/api-service
dotnet run
```

- API: `http://localhost:5080`
- Health check: `http://localhost:5080/api/health`
- Swagger UI: `http://localhost:5080/swagger`

### 2. Frontend — `web-store`

```bash
cd apps/web-store
npm install
npm run dev
```

- Tienda: `http://localhost:5173`
- La URL de la API se configura con `VITE_API_URL` (ver `apps/web-store/.env.example`).

### 3. Panel administrativo — `admin-panel`

```bash
npm --prefix apps/admin-panel install
npm --prefix apps/admin-panel run dev
```

- Panel: `http://localhost:5174` (cuentas demo y detalles en [`apps/admin-panel/README.md`](apps/admin-panel/README.md)).
- Pruebas: `npm --prefix apps/admin-panel test`.

### Compilación

```bash
# Frontend
cd apps/web-store && npm run build

# Panel administrativo
cd apps/admin-panel && npm run build

# Backend
cd apps/api-service && dotnet build
```

## CI

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) corre en cada PR hacia `main` y en cada push a `main`. Un push nuevo al mismo PR cancela la ejecución anterior.

| Job | Corre si cambió… | Pasos |
|---|---|---|
| `changes` | siempre | Detecta qué apps cambiaron (`dorny/paths-filter`) |
| `web-store` | `apps/web-store/**` o el workflow | Node LTS · `npm ci` · `npm run lint` · `npm test` · `npm run build` |
| `admin-panel` | `apps/admin-panel/**` o el workflow | Node LTS · `npm ci` · `npm run lint` · `npm test` · `npm run build` |
| `api-service` | `apps/api-service/**`, `docs/design/DESIGN_DB.md` o el workflow | .NET 10 · `dotnet restore` · `dotnet build -c Release` · `dotnet test` (solo si existe `apps/api-service.Tests`) |

Un job que no aplica queda como *skipped*, y GitHub lo cuenta como exitoso, así que no bloquea el merge. Para correr lo mismo en local:

```bash
# Tienda
cd apps/web-store && npm ci && npm run lint && npm test && npm run build

# Panel administrativo
cd apps/admin-panel && npm ci && npm run lint && npm test && npm run build

# Backend
cd apps/api-service && dotnet restore Sokko.Api.csproj && dotnet build Sokko.Api.csproj --no-restore -c Release
```

## Endpoints

| Método | Ruta          | Descripción                         |
|--------|---------------|-------------------------------------|
| GET    | `/api/health` | Estado del servicio SOKKO           |

---

<div align="center"><sub>Proyecto académico · Arquitectura Orientada a Servicios</sub></div>
