# Black Iron Barbers

> Proyecto de portafolio con datos ficticios.

Sitio web de una barbería: catálogo de servicios, galería, reserva de citas online y dos paneles privados (barbero y
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
| `npm run seed` | Siembra barberos, el catálogo de servicios (upsert por nombre) y el admin inicial; se puede repetir sin duplicar |
| `npm test` | Tests con Vitest + Supertest contra una base de pruebas aislada |

Para correr `npm test` en local, copia `backend/.env.test.example` a
`backend/.env.test` y pon ahí tus credenciales locales de Postgres. El
`DB_NAME` de ese archivo **debe ser distinto** al de desarrollo (por
ejemplo `black_iron_test`): los tests crean esa base, le aplican el
esquema y la limpian antes de cada corrida, sin tocar la base real.

## Catálogo de servicios

39 servicios en 6 categorías, con tipo `original`, `elite` o `vip`, descripción, duración y precio (0 se muestra como "Gratis").
La fuente del catálogo está en `backend/db/data/` y el seed la aplica por nombre, sin borrar nada: los 6 servicios del catálogo
anterior quedan inactivos para conservar el historial de citas, y los ids de los nuevos los asigna la secuencia.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/servicios` | Servicios activos. Filtros: `categoria` (slug), `tipo`, `q`. Orden: `ordenar` (`precio`, `duracion`, `nombre`) y `direccion`. `agrupar=categoria` los devuelve por categoría |
| GET | `/api/servicios/:id` | Un servicio activo (404 si no existe o está inactivo) |
| GET | `/api/categorias` | Categorías en orden, con `total_servicios` |

Un parámetro desconocido, repetido o inválido responde 400. Reservar o consultar disponibilidad de un servicio inexistente o inactivo
responde 400 con `codigo: "SERVICIO_NO_DISPONIBLE"`. Hay ejemplos con `curl` en
[docs/pruebas-manuales-servicios.md](./docs/pruebas-manuales-servicios.md) y
[docs/pruebas-manuales-reservas.md](./docs/pruebas-manuales-reservas.md).

## Rutas principales

`/`, `/cortes`, `/reservar-corte`, `/acceso` (login de barberos/admin, sin enlaces
públicos y con `noindex`), `/panel` (barbero) y `/admin`
(administrador).

## Más contexto

Ver [CLAUDE.md](./CLAUDE.md) para el modelo de datos, la API, las
convenciones de código y las reglas de seguridad del proyecto.
