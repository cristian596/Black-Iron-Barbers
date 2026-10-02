# Black Iron Barbers

Sitio web de una barbería: catálogo de servicios, galería, carta de bebidas,
ubicación, reserva de citas online y dos paneles privados (barbero y
administrador).

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + React Router 7 + Swiper + React Icons
- **Backend:** Node.js + Express 5 + PostgreSQL 15 (`pg`) + `bcryptjs` + `jsonwebtoken`
- **Tests:** Vitest + React Testing Library (front) · Vitest + Supertest (back)
- **CI:** GitHub Actions (lint, build y tests en cada push/PR)
- **Infra:** Docker Compose (backend + Postgres)

## Requisitos

- Node.js 20+
- Docker (para levantar Postgres y el backend con `docker compose`)

## Puesta en marcha

```bash
# Variables de entorno (nunca commitear el .env real)
cp .env.example .env

# Frontend
npm install
npm run dev          # http://localhost:5173

# Backend + Postgres
docker compose up --build
```

## Scripts del frontend

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 5173) |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint — debe dar 0 errores |
| `npm test` | Tests con Vitest + React Testing Library |

## Scripts del backend (`cd backend`)

| Comando | Qué hace |
|---|---|
| `npm start` | Levanta el servidor (necesita Postgres) |
| `npm run seed` | Siembra barberos, servicios y el admin inicial |
| `npm test` | Tests con Vitest + Supertest contra una base de pruebas aislada |

Para correr `npm test` en local, copia `backend/.env.test.example` a
`backend/.env.test` y pon ahí tus credenciales locales de Postgres. El
`DB_NAME` de ese archivo **debe ser distinto** al de desarrollo (por
ejemplo `black_iron_test`): los tests crean esa base, le aplican el
esquema y la limpian antes de cada corrida, sin tocar la base real.

## Rutas principales

`/`, `/cortes`, `/galeria`, `/ubicacion`, `/reservar-corte`,
`/carta-bebidas`, `/acceso` (login de barberos/admin, sin enlaces
públicos y con `noindex`), `/panel` (barbero) y `/admin`
(administrador).

## Más contexto

Ver [CLAUDE.md](./CLAUDE.md) para el modelo de datos, la API, las
convenciones de código y las reglas de seguridad del proyecto.
