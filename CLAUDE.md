# CLAUDE.md

Contexto para Claude Code sobre el proyecto **Black Iron Barbers**. Léelo antes de proponer cambios.

## Qué es este proyecto

Sitio web de una **barbería** (solo servicios de barbería): catálogo de servicios, galería, carta de bebidas, ubicación, reserva de citas online y dos paneles privados:

- **Barbero** (`/panel`): ve y gestiona solo sus propias citas.
- **Administrador** (`/admin`): ve todas las citas (pendientes y realizadas), el barbero a cargo de cada una, y gestiona los usuarios de los barberos.

Ya **no** se ofrecen servicios de mujer (uñas, pedicura, cortes de dama). Si aparece código, datos o imágenes de ese tipo, se elimina.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + React Router 7 + Swiper + React Icons
- **Backend:** Node.js + Express 5 + PostgreSQL 15 (`pg`) + `bcryptjs` + `jsonwebtoken`
- **Infra:** Docker Compose (backend + Postgres)

## Estructura

```
backend/
├── index.js            solo arranque del servidor
├── app.js              express, cors, rutas, manejo de errores
├── config/env.js       valida variables de entorno al arrancar
├── db/                 connection.js, schema.sql, seed.js
├── routes/             auth, barberos, servicios, citas, admin
├── controllers/        lógica de cada ruta
└── middlewares/        verificarToken, requiereRol, errorHandler, validate
public/                 imágenes estáticas
src/
├── components/{layout,sections,ui}
├── context/            AuthContext
├── data/               datos estáticos (siempre arrays + .map())
├── pages/              una página por ruta (incluye Panel y Admin)
├── routes/             AppRouter, ProtectedRoute, RoleRoute
└── services/api.js     único lugar con llamadas HTTP
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Frontend en desarrollo (puerto 5173) |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint — correr SIEMPRE antes de dar una tarea por terminada |
| `cd backend && npm start` | Levanta el backend (necesita Postgres) |
| `docker compose up --build` | Backend + Postgres juntos |

## Modelo de datos

- `barberos`: `id`, `nombre`, `cargo`, `especialidad`, `foto`, `activo` (el personal que se muestra en la web)
- `usuarios`: `id`, `usuario` (único), `contrasena` (hash bcrypt), `rol` (`admin` | `barbero`), `barbero_id` (nulo para el admin), `activo`
- `servicios`: `id`, `nombre`, `duracion_min`, `precio` (solo barbería)
- `citas`: `id`, `cliente`, `correo`, `servicio_id`, `barbero_id`, `fecha` (DATE), `hora` (TIME), `estado` (`pendiente` | `completada` | `cancelada`), `creada_en`; `UNIQUE (barbero_id, fecha, hora)`

## Autenticación y roles

- Un solo login (`POST /api/auth/login`). El JWT lleva `id`, `rol` y `barbero_id`.
- El **administrador crea el usuario y la contraseña de cada barbero** (`POST /api/admin/usuarios`). No existe registro público.
- El admin inicial se crea con el seed usando `ADMIN_USER` y `ADMIN_PASSWORD` del `.env`.
- Los usuarios se **desactivan** (`activo = false`), nunca se borran, para conservar el historial de citas.
- El barbero puede cambiar su propia contraseña (`PATCH /api/auth/contrasena`).

## API

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login` | público |
| PATCH | `/api/auth/contrasena` | JWT |
| GET | `/api/barberos`, `/api/servicios`, `/api/disponibilidad` | público |
| POST | `/api/citas` | público |
| GET | `/api/citas` | JWT; barbero ve solo las suyas, admin ve todas |
| PATCH | `/api/citas/:id` | JWT; barbero solo si la cita es suya, admin cualquiera |
| GET | `/api/admin/resumen` | solo admin |
| POST | `/api/admin/usuarios` | solo admin |
| PATCH | `/api/admin/usuarios/:id` | solo admin |

## Convenciones de código

- **No** importar `React` en componentes (React 19 no lo necesita).
- Importar **solo** de `react-router-dom`, nunca de `react-router`.
- Ningún dato repetido a mano en JSX: 3+ elementos similares van como array en `src/data/` (o vienen de la API) y se renderizan con `.map()`.
- Los servicios (nombre, precio, duración) tienen **una sola fuente de verdad**: la API.
- Todas las llamadas HTTP pasan por `src/services/api.js`.
- Toda imagen lleva `alt` descriptivo, nunca `alt=""`.
- Todo input tiene `<label htmlFor>` enlazado a su `id`.
- Usar `<Link>` / `<NavLink>` para navegar, nunca `<a href>` interno.
- Consultas SQL siempre parametrizadas (`$1, $2`), nunca concatenar strings.

## Seguridad — reglas que NO se negocian

- Nunca hardcodear contraseñas, secretos o connection strings en código ni en `docker-compose.yml`. Todo va en `.env` (no versionado) y se referencia con `${VARIABLE}`.
- Las contraseñas se guardan SIEMPRE hasheadas con bcrypt y **nunca** se devuelven en ninguna respuesta de la API.
- Los permisos se aplican **en el back-end**: filtrar citas por el `barbero_id` del token, no por lo que mande el cliente. Ocultar botones en el front no es seguridad.
- La doble reserva se evita con el `UNIQUE` de la base de datos; responder `409` ante el error `23505`.
- Validar el body de cada endpoint antes de tocar la base de datos.
- CORS restringido a `FRONTEND_URL`; rate limiting en el login.
- No reescribir el historial de git (`filter-repo`, `rebase` sobre commits ya pusheados) sin confirmación explícita.
- No hacer commit de `.env` reales; solo `.env.example` con placeholders.
- La contraseña de Postgres que estuvo en el repo público se considera comprometida: no reutilizarla.

## Estado actual

- Front-end visualmente avanzado pero **sin ninguna llamada a la API**; login y reserva sin lógica.
- Back-end con solo `GET /` y creación de tablas en `index.js`.
- Pendiente eliminar todo lo relacionado con servicios de mujer (datos, secciones, fotos y carpetas `CourtWoman`, `Nails`, `NailsThematic`, `Pedicura`).
- Pendiente: 36 errores de ESLint, `Cortes.jsx` y `Galeria.jsx` con JSX repetido, `App.jsx` sin uso, rutas `galery`/`ubication`, `logo.png` de 1.2 MB, sin tests ni CI.
- El plan completo por sesiones está en `checklist-sesiones.md`.

## Cómo trabajar en este repo

- Cada sesión se enfoca en **un bloque** del checklist; no mezcles bloques salvo que se pida.
- Antes de dar una tarea por terminada: `npm run lint` en el front y que `npm start` levante sin errores en el back.
- Verifica los permisos con pruebas reales (por ejemplo, que un barbero no pueda ver ni modificar citas de otro).
- Si algo es ambiguo y no afecta seguridad ni arquitectura, elige la opción más estándar y continúa.
- Si la decisión afecta seguridad, permisos, datos de la base o borra archivos, pregunta antes.
