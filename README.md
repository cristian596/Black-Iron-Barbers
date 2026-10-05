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
| `npm run seed` | Siembra barberos, el admin inicial y **solo inserta** lo que falte del catálogo (nunca pisa, reactiva ni desactiva lo que el admin edite); se puede repetir. `-- --restablecer-catalogo [--confirmar]` vuelve el catálogo a los datos de los archivos (solo desarrollo; sin `--confirmar` solo muestra qué sobrescribiría) |
| `npm run seed:demo` | Citas de demostración, **solo desarrollo**: simula por defecto; `-- --confirmar` las crea y `-- --limpiar --confirmar` borra únicamente las marcadas `[demo]` |
| `npm test` | Tests con Vitest + Supertest contra una base de pruebas aislada |

Para correr `npm test` en local, copia `backend/.env.test.example` a
`backend/.env.test` y pon ahí tus credenciales locales de Postgres. El
`DB_NAME` de ese archivo **debe ser distinto** al de desarrollo (por
ejemplo `black_iron_test`): los tests crean esa base, le aplican el
esquema y la limpian antes de cada corrida, sin tocar la base real.

## Catálogo de servicios

39 servicios en 6 categorías, con tipo `original`, `elite` o `vip`, descripción, duración y precio (0 se muestra como "Gratis").
El catálogo inicial está en `backend/db/data/` (cada categoría y servicio lleva una `clave` estable, que se guarda en `clave_seed`).
El seed **solo inserta lo que falta**: lo que el admin edite desde `/admin/servicios` (precio, nombre, activo…) nunca se pisa, y los
servicios que él cree no los toca. Los 6 servicios del catálogo anterior se desactivan una sola vez (paso registrado en
`migraciones_aplicadas`) para conservar el historial de citas, y los ids de los nuevos los asigna la secuencia.

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
públicos y con `noindex`), `/panel` (barbero) y el panel del administrador:

| Ruta | Qué muestra |
|---|---|
| `/admin` | Resumen: indicadores con comparación, gráfico de ingresos, servicios más pedidos y citas recientes |
| `/admin/citas` | Todas las citas: pestañas, búsqueda, barbero, rango de fechas, paginación de 15 y acciones (todo en la URL) |
| `/admin/servicios` | Servicios y categorías: crear, editar y activar o desactivar (sin borrar). Tabla con panel lateral en escritorio; tarjetas y panel a pantalla completa en móvil |
| `/admin/reportes` | Reporte diario: elige un día (por defecto hoy, el siguiente se bloquea en hoy; queda en la URL con `?fecha=`) y ve cortes, ingresos, ticket promedio, canceladas y servicios más pedidos. Descarga CSV (separador `;`, abre bien en Excel) o imprime (sin menús ni botones, en blanco y negro) |
| `/admin/empleados` | Empleados: crear (barbero + usuario), editar, activar o desactivar (sin borrar) y restablecer contraseña. Muestra cortes del mes y citas pendientes de cada uno |

Endpoints del admin (`/api/admin/*`, solo rol admin): `estadisticas`, `estadisticas/ingresos`,
`estadisticas/servicios-top`, `citas`, `servicios` y `categorias`, `empleados` (GET, POST y PATCH; no hay DELETE), `reportes/diario` y `reportes/diario.csv` (GET) y `usuarios`. Desactivar a un empleado desactiva también su usuario, lo saca de la web y de la reserva e invalida su sesión al instante. Una cita solo se puede completar si su fecha es hoy
(hora de Bogotá) o anterior; si no, la API responde 400 con `codigo: "CITA_FUTURA"`.

## Más contexto

Ver [CLAUDE.md](./CLAUDE.md) para el modelo de datos, la API, las
convenciones de código y las reglas de seguridad del proyecto.
