# CLAUDE.md

Contexto para Claude Code sobre el proyecto **Black Iron Barbers**. Léelo antes de proponer cambios.

## Qué es este proyecto

> Proyecto de portafolio con datos ficticios.

Sitio web de una **barbería** (solo servicios de barbería): catálogo de servicios, reserva de citas online y dos paneles privados:

- **Barbero** (`/panel`): ve y gestiona solo sus propias citas.
- **Administrador** (`/admin`): ve todas las citas (pendientes y realizadas), el barbero a cargo de cada una, y gestiona los usuarios de los barberos.

El acceso a estos paneles es solo para barberos y admin, no para clientes: el login vive en `/acceso` (antes `/login-barberos`), sin ningún enlace visible en la navegación pública, con `<meta name="robots" content="noindex, nofollow">` (igual que `/panel` y `/admin`) y bloqueado en `public/robots.txt`. La ruta vieja `/login-barberos` ya no existe (muestra 404). Esto es solo para que el sitio no "invite" a clientes a buscar el login; la seguridad real sigue estando en el back-end (JWT + roles).

Ya **no** se ofrecen servicios de mujer (uñas, pedicura, cortes de dama). Si aparece código, datos o imágenes de ese tipo, se elimina.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + React Router 7 + Swiper + React Icons
- **Backend:** Node.js + Express 5 + PostgreSQL 15 (`pg`) + `bcryptjs` + `jsonwebtoken`
- **Tests:** Vitest + React Testing Library (front) · Vitest + Supertest (back, contra una base de pruebas aislada)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — lint, build y tests en cada push/PR
- **Infra:** Docker Compose (backend + Postgres)

## Estructura

```
backend/
├── index.js            solo arranque del servidor
├── app.js              express, cors, rutas, manejo de errores (exporta crearApp() para tests)
├── config/env.js       valida variables de entorno al arrancar
├── db/                 connection.js, schema.sql, seed.js
├── routes/             auth, barberos, servicios, citas, admin
├── controllers/        lógica de cada ruta
├── middlewares/        verificarToken, requiereRol, errorHandler, validate
└── tests/              Vitest + Supertest; globalSetup crea/siembra black_iron_test
public/                 imágenes estáticas
src/
├── components/{layout,sections,ui}
├── context/            AuthContext
├── data/               datos estáticos (siempre arrays + .map())
├── pages/              una página por ruta (incluye Panel y Admin)
├── routes/             AppRouter (con React.lazy + Suspense), ProtectedRoute, RoleRoute
├── services/api.js     único lugar con llamadas HTTP
└── tests/              Vitest + React Testing Library (mockean src/services/api.js)
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Frontend en desarrollo (puerto 5173) |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint — correr SIEMPRE antes de dar una tarea por terminada |
| `npm test` | Tests del front (Vitest + React Testing Library) |
| `cd backend && npm start` | Levanta el backend (necesita Postgres) |
| `cd backend && npm test` | Tests del back (Vitest + Supertest, usa `backend/.env.test`, nunca la base de desarrollo) |
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
- No reescribas el historial de git ni hacer commits.
- Si no tienes claro algun cambio, preguntame no inventes ni empiezes a divagar.

## Estado actual

- Front-end conectado a la API (login, reserva, paneles de barbero y admin) y back-end completo (auth, citas, admin).
- Rutas públicas: `/`, `/cortes`, `/reservar-corte` y `/acceso`. Se eliminaron las páginas de carta de bebidas, ubicación y la sección `Descripcion` del inicio (`/ubicacion` y `/carta-bebidas` muestran la 404); la dirección y el horario salen de `src/data/negocio.js`.
- `Cortes.jsx` y `Galeria.jsx` sin JSX repetido: `Cortes.jsx` lee de `GET /api/servicios`, `Galeria.jsx` usa `src/data/galeria.js` + `.map()`.
- ESLint en 0 errores/warnings; `App.jsx` eliminado; todo unificado en `react-router-dom`.
- Rendimiento: logo comprimido a WebP (1.22 MB → ~109 KB), `loading="lazy"` en imágenes bajo el pliegue, rutas con `React.lazy` + `Suspense`.
- Tests (front y back) y CI en GitHub Actions ya configurados.
- Pendiente: desplegar a producción (ver sección "Después: despliegue" en `checklist-sesiones.md`); revisar las fotos `hair_woman_*` que quedaron en `public/Hair` sin usar (no se borraron sin confirmación).
- El plan completo por sesiones está en `checklist-sesiones.md`.

## Cómo trabajar en este repo

- Cada sesión se enfoca en **un bloque** del checklist; no mezcles bloques salvo que se pida.
- Antes de dar una tarea por terminada: `npm run lint` en el front y que `npm start` levante sin errores en el back.
- Verifica los permisos con pruebas reales (por ejemplo, que un barbero no pueda ver ni modificar citas de otro).
- Si algo es ambiguo y no afecta seguridad ni arquitectura, elige la opción más estándar y continúa.
- Si la decisión afecta seguridad, permisos, datos de la base o borra archivos, pregunta antes.
- Siempre usar tailwind, nunca usar ccs puro ni crear archivos innecesarios.
- Siempre trabajar pensando en que la pagina debe ser responsive, SIEMPRE.
- No hagas commits ni push, ni locales ni remotos. El desarrollador los hace manualmente. Al terminar cada bloque, indica qué archivos cambiaron y detente para que lo revise.
