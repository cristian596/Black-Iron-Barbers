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
├── db/                 connection.js, schema.sql, seed.js, sembrarCatalogo.js, data/ (catálogo y descripciones)
├── routes/             auth, barberos, servicios, categorias, citas, admin
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
- `categorias`: `id`, `nombre` (único), `slug` (único), `orden` (orden de aparición)
- `servicios`: `id`, `nombre` (único; distingue mayúsculas), `descripcion`, `duracion_min` (> 0), `precio` (>= 0; 0 se muestra como "Gratis"), `tipo` (`original` | `elite` | `vip`), `categoria_id` (→ `categorias`), `activo` (solo barbería)
  - Los servicios **nunca se borran**: los del catálogo anterior (ids 1–6) quedan con `activo = false` para conservar el historial de citas. La API pública y la reserva solo ven los activos.
  - `categoria_id`, `tipo` y `descripcion` admiten NULL solo por las filas anteriores a este cambio; todo servicio activo los tiene.
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
| GET | `/api/barberos`, `/api/disponibilidad` | público |
| GET | `/api/servicios`, `/api/servicios/:id`, `/api/categorias` | público (ver detalle abajo) |
| POST | `/api/citas` | público |
| GET | `/api/citas` | JWT; barbero ve solo las suyas, admin ve todas |
| PATCH | `/api/citas/:id` | JWT; barbero solo si la cita es suya, admin cualquiera |
| GET | `/api/admin/resumen` | solo admin |
| POST | `/api/admin/usuarios` | solo admin |
| PATCH | `/api/admin/usuarios/:id` | solo admin |

### Catálogo de servicios

- `GET /api/servicios`: solo servicios activos, cada uno con `id`, `nombre`, `descripcion`, `precio`, `duracion_min`, `tipo` y `categoria` (`{ id, nombre, slug }`).
  - Filtros (todos opcionales y combinables): `categoria` (slug), `tipo` (`original` | `elite` | `vip`), `q` (búsqueda por nombre, máx. 100 caracteres; `%`, `_` y `\` se escapan).
  - Orden: `ordenar` (`precio` | `duracion` | `nombre`) y `direccion` (`asc` | `desc`, requiere `ordenar`). Por defecto: categoría, precio y nombre.
  - `agrupar=categoria` devuelve `[{ categoria, servicios }]` en el orden de las categorías; las categorías sin resultados no aparecen.
- `GET /api/servicios/:id`: un servicio activo. 400 si el id no es numérico; 404 si no existe o está inactivo.
- `GET /api/categorias`: `id`, `nombre`, `slug`, `orden` y `total_servicios` (solo activos), en orden.
- Errores: 400 (con `error`) ante parámetros desconocidos, repetidos (`?tipo=a&tipo=b`, `?tipo[]=`) o con valor inválido, y ante una categoría que no existe.
- `POST /api/citas` y `GET /api/disponibilidad` responden **400 con `codigo: "SERVICIO_NO_DISPONIBLE"`** si el servicio no existe o está inactivo (`/api/disponibilidad` mantiene 404 para un id que no existe). El front usa ese `codigo` para devolver al cliente al paso Servicio.

### Seed del catálogo

- `npm run seed` es idempotente: hace **upsert por nombre** (`ON CONFLICT (nombre)`) de las categorías y los 39 servicios de `backend/db/data/servicios.js` y `descripciones.js` (son la fuente del catálogo; el `id` de esos archivos solo sirve para casar cada servicio con su descripción).
- Los ids reales los asigna la secuencia, así que hay **huecos** y no coinciden con los de los archivos. No usar esos ids como referencia.
- El mismo seed desactiva (`activo = false`) los 6 servicios del catálogo anterior. Se puede correr las veces que haga falta sin duplicar nada.

## Convenciones de código

- **No** importar `React` en componentes (React 19 no lo necesita).
- Importar **solo** de `react-router-dom`, nunca de `react-router`.
- Ningún dato repetido a mano en JSX: 3+ elementos similares van como array en `src/data/` (o vienen de la API) y se renderizan con `.map()`.
- Los servicios (nombre, descripción, precio, duración, tipo, categoría) tienen **una sola fuente de verdad**: la API. El front ya no deduce nada por nombre (se eliminaron `categoriasServicios.js` y `descripcionesServicios.js`).
- Precios siempre con `formatearPrecio` (`src/utils/formato.js`): da `$18.000` y "Gratis" si el precio es 0. Nunca formatear a mano.
- Catálogo y paso 1 de la reserva comparten `FiltrosServicios`, `useFiltroServicios`, `InsigniaTipo` (Original / Élite / VIP) y `TarjetaServicio`. Los filtros son botones con `aria-pressed` dentro de `role="group"` (no `role="tab"`); la lista se carga una vez y se filtra en el cliente. Los errores de carga usan `ErrorCarga` (`role="alert"` + "Reintentar").
- Responsive: en un contenedor `grid` que tenga hijos con scroll interno (`overflow-x-auto`), usar `grid-cols-1` y `min-w-0` en el hijo. Sin eso, la columna automática se estira al ancho del contenido y desborda la página en móvil. Medir con `scrollWidth` vs `clientWidth` en 360–414 px.
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
- `Cortes.jsx` y `Galeria.jsx` sin JSX repetido: `Cortes.jsx` lee de `GET /api/servicios` (catálogo con filtros por categoría y tipo), `Galeria.jsx` usa `src/data/galeria.js` + `.map()`.
- ESLint en 0 errores/warnings; `App.jsx` eliminado; todo unificado en `react-router-dom`.
- Rendimiento: logo comprimido a WebP (1.22 MB → ~109 KB), `loading="lazy"` en imágenes bajo el pliegue, rutas con `React.lazy` + `Suspense`.
- Tests (front y back) y CI en GitHub Actions ya configurados.
- Catálogo de 39 servicios en 6 categorías con tipos original/élite/VIP; `/cortes` y el paso 1 de `/reservar-corte` lo muestran con filtros (el paso 1 añade buscador). La sección de servicios ya no está en el inicio, que enlaza a `/cortes`.
- Pendiente (fuera de este trabajo): CRUD de servicios para el admin y las asesorías gratuitas.
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
