# CLAUDE.md

Contexto para Claude Code sobre el proyecto **Black Iron Barbers**. Léelo antes de proponer cambios.

## Qué es este proyecto

> Proyecto de portafolio con datos ficticios.

Sitio web de una **barbería** (solo servicios de barbería): catálogo de servicios, reserva de citas online y dos paneles privados:

- **Barbero** (`/panel`): ve y gestiona solo sus propias citas.
- **Administrador** (`/admin`): ve todas las citas (pendientes y realizadas), el barbero a cargo de cada una, y gestiona servicios, categorías y empleados (barberos con su usuario).

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
├── pages/              una página por ruta (Panel; y pages/admin/ con AdminLayout + una página por sección)
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
| `cd backend && npm run seed:demo` | Citas de demostración (solo desarrollo): simula; con `-- --confirmar` crea; `-- --limpiar --confirmar` borra solo las `[demo]` |

## Modelo de datos

- `barberos`: `id`, `nombre`, `cargo`, `especialidad`, `foto` (nula en los creados desde el admin: la web muestra un avatar con iniciales), `activo` (el personal que se muestra en la web)
- `usuarios`: `id`, `usuario` (único), `contrasena` (hash bcrypt), `rol` (`admin` | `barbero`), `barbero_id` (nulo para el admin), `activo`
- `categorias`: `id`, `nombre` (único), `slug` (único; se genera del nombre al crear y no se edita), `orden` (orden de aparición), `activo` (una categoría inactiva no aparece en la web), `clave_seed` (nulo = creada por el admin)
- `servicios`: `id`, `nombre` (único; distingue mayúsculas), `descripcion`, `duracion_min` (> 0), `precio` (>= 0; 0 se muestra como "Gratis"), `tipo` (`original` | `elite` | `vip`), `categoria_id` (→ `categorias`), `activo`, `clave_seed` (solo barbería)
  - Los servicios **nunca se borran**: los del catálogo anterior (ids 1–6) quedan con `activo = false` para conservar el historial de citas. La API pública y la reserva solo ven los activos.
  - `categoria_id`, `tipo` y `descripcion` admiten NULL solo por las filas anteriores a este cambio; todo servicio activo los tiene (el admin debe completarlos para reactivar uno del catálogo anterior).
  - `clave_seed` (único, nullable): identificador estable de las filas que vienen de `backend/db/data`. El seed y la migración casan por él, no por el nombre. Nulo = creado por el admin; el seed no lo toca jamás.
- `migraciones_aplicadas`: `clave` (PK), `aplicada_en`. Registro de los pasos de datos que se ejecutan una sola vez (`catalogo-claves-seed-v1`, `catalogo-legado-desactivado-v1`).
- `citas`: `id`, `cliente`, `correo`, `servicio_id`, `barbero_id`, `fecha` (DATE), `hora` (TIME), `estado` (`pendiente` | `completada` | `cancelada`), `creada_en`; `UNIQUE (barbero_id, fecha, hora)`

## Autenticación y roles

- Un solo login (`POST /api/auth/login`). El JWT lleva `id`, `rol` y `barbero_id`.
- El **administrador crea el usuario y la contraseña de cada barbero** (`POST /api/admin/usuarios`). No existe registro público.
- El admin inicial se crea con el seed usando `ADMIN_USER` y `ADMIN_PASSWORD` del `.env`.
- Los usuarios se **desactivan** (`activo = false`), nunca se borran, para conservar el historial de citas.
- `verificarToken` no se fía solo del JWT: en cada petición consulta `usuarios` (y `barberos` si es barbero) y responde 401 `SESION_INVALIDA` si el usuario o su barbero están inactivos o ya no existen. Así, desactivar a un empleado invalida su token al instante (si no, seguiría valiendo hasta 8 h). El `rol` y el `barbero_id` de `req.usuario` salen de la base, no del token. Costo: una consulta por clave primaria por petición.
- Un empleado es un barbero más su usuario, y **siempre en el mismo estado**: crear, desactivar y reactivar tocan ambos en una transacción. Puede haber varios usuarios ligados al mismo barbero (datos de prueba antiguos); el listado muestra uno (el activo, o el más reciente) y `usuarios_total`.
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
| PATCH | `/api/citas/:id` | JWT; barbero solo si la cita es suya, admin cualquiera. Completar solo si la fecha ≤ hoy (Bogotá): si no, 400 `codigo: "CITA_FUTURA"` |
| GET | `/api/admin/estadisticas?periodo=hoy\|7d\|30d\|mes` | solo admin |
| GET | `/api/admin/estadisticas/ingresos?agrupar=dia\|mes` | solo admin |
| GET | `/api/admin/estadisticas/servicios-top?periodo=&limite=` | solo admin |
| GET | `/api/admin/citas?pestana=&q=&desde=&hasta=&barbero=&pagina=&limite=` | solo admin |
| GET, POST | `/api/admin/servicios` | solo admin (el GET incluye inactivos; filtros `activo`, `categoria`, `q`) |
| PATCH | `/api/admin/servicios/:id` | solo admin (campos y `activo`; sin DELETE) |
| GET, POST | `/api/admin/categorias` | solo admin |
| PATCH | `/api/admin/categorias/:id` | solo admin (`nombre`, `orden`, `activo`; el slug no se edita; sin DELETE) |
| GET | `/api/admin/empleados` | solo admin (todos, activos e inactivos; sin parámetros) |
| POST | `/api/admin/empleados` | solo admin (crea barbero y usuario en una transacción; sin DELETE) |
| PATCH | `/api/admin/empleados/:id` | solo admin (`nombre`, `cargo`, `especialidad`, `activo`) |
| GET | `/api/admin/usuarios` | solo admin (incluye los de barberos inactivos) |
| POST | `/api/admin/usuarios` | solo admin (acceso para un barbero que no tiene; 409 `BARBERO_INACTIVO` si el barbero está inactivo) |
| PATCH | `/api/admin/usuarios/:id` | solo admin (restablecer contraseña; no se puede activar el usuario de un barbero inactivo) |

### Catálogo de servicios

- `GET /api/servicios`: solo servicios activos, cada uno con `id`, `nombre`, `descripcion`, `precio`, `duracion_min`, `tipo` y `categoria` (`{ id, nombre, slug }`).
  - Filtros (todos opcionales y combinables): `categoria` (slug), `tipo` (`original` | `elite` | `vip`), `q` (búsqueda por nombre, máx. 100 caracteres; `%`, `_` y `\` se escapan).
  - Orden: `ordenar` (`precio` | `duracion` | `nombre`) y `direccion` (`asc` | `desc`, requiere `ordenar`). Por defecto: categoría, precio y nombre.
  - `agrupar=categoria` devuelve `[{ categoria, servicios }]` en el orden de las categorías; las categorías sin resultados no aparecen.
- `GET /api/servicios/:id`: un servicio activo. 400 si el id no es numérico; 404 si no existe o está inactivo.
- `GET /api/categorias`: `id`, `nombre`, `slug`, `orden` y `total_servicios` (solo activos), en orden.
- Errores: 400 (con `error`) ante parámetros desconocidos, repetidos (`?tipo=a&tipo=b`, `?tipo[]=`) o con valor inválido, y ante una categoría que no existe.
- `POST /api/citas` y `GET /api/disponibilidad` responden **400 con `codigo: "SERVICIO_NO_DISPONIBLE"`** si el servicio no existe o está inactivo (`/api/disponibilidad` mantiene 404 para un id que no existe). El front usa ese `codigo` para devolver al cliente al paso Servicio.

### Dashboard del administrador

- **Rutas** (`AppRouter`: `/admin` es un layout con rutas hijas lazy; el guard `ProtectedRoute` + `RoleRoute rol="admin"` está una sola vez en el padre): `/admin` (Resumen), `/admin/citas`, `/admin/servicios` (catálogo y categorías), `/admin/empleados` (barberos y su acceso) y `/admin/reportes` (aún provisional). Cualquier otra ruta bajo `/admin` vuelve a `/admin`. El buscador de la barra superior lleva a `/admin/citas?q=`.
- **Estadísticas** (todo bajo `/api/admin`, parámetros desconocidos/repetidos/inválidos → 400): "hoy" lo decide Node con `hoyISO()` de `backend/utils/fechas.js` (Bogotá), nunca `CURRENT_DATE`/`NOW()`. Ingresos = `SUM(citas.precio)` de las completadas (precio guardado en la cita). Las canceladas no suman y se cuentan aparte. El ticket promedio excluye las completadas de precio 0. Las series usan `generate_series(0, n)` sumado a una fecha (no dependen de la zona de la sesión de Postgres). `/estadisticas/ingresos` devuelve 30 días (o 12 meses) y los 30 (12) anteriores. Las consultas SQL viven en `backend/db/estadisticas.js`.
- **Lista de citas del admin** (`GET /api/admin/citas`): pestañas `proximas` (pendientes que aún no empiezan, las más cercanas primero), `todas` y `canceladas` (más recientes primero). Las pendientes de un día/hora pasados llevan `vencida: true` y no entran en `proximas`. Paginada: `limite` por defecto 10, máximo 50 (la pantalla pide 15). `q` busca en cliente, servicio y barbero (escapa `%`, `_` y `\`). `fecha`/`hora` salen como texto.
- **Catálogo del admin** (`adminCatalogoController.js`): sin DELETE (se activa o desactiva). Servicio: `nombre` 1–150 y único sin distinguir mayúsculas (solo se valida al crear o al cambiar el nombre, para no afectar filas ya existentes como "Exfoliación Facial"/"Exfoliación facial"), `precio` entero ≥ 0, `duracion_min` entero 1–600, `tipo` original/elite/vip, `categoria_id` existente y **activa**, `descripcion` obligatoria (máx. 500); campos desconocidos → 400; PATCH exige al menos un campo. Activar un servicio exige categoría activa, tipo y descripción (`SERVICIO_INCOMPLETO`). Categoría: slug generado del nombre (con sufijo `-2`, `-3`… si choca); desactivar una con servicios activos → 409 `CATEGORIA_CON_SERVICIOS`. Todos los errores llevan `codigo` estable (`DATOS_INVALIDOS` con `campo`, `NOMBRE_DUPLICADO`, `CATEGORIA_NO_DISPONIBLE`, `SERVICIO_INCOMPLETO`, `CATEGORIA_CON_SERVICIOS`, `SLUG_NO_EDITABLE`, `*_NO_ENCONTRADO`, `ID_INVALIDO`). Editar precio o duración no altera las citas ya creadas (guardan su propio precio y duración). `/api/servicios` y `/api/categorias` (públicas) solo muestran lo activo y nada de una categoría inactiva.
- **Empleados** (`adminEmpleadosController.js`): sin DELETE. `GET` devuelve, por barbero, `usuario` (`{ id, usuario, activo }` o `null`), `usuarios_total`, `cortes_mes` (completadas del mes en curso en Bogotá, con los límites calculados en Node) y `citas_pendientes` (pendientes que aún no empiezan). `POST` valida (`nombre` 1–100, `cargo` ≤ 100 y `especialidad` ≤ 150 opcionales, `usuario` 1–50, contraseña 8–72), hashea con bcrypt y crea barbero y usuario en una transacción: un usuario repetido responde 409 `USUARIO_DUPLICADO` y no deja un barbero huérfano. `PATCH` con `activo: false` apaga barbero y todos sus usuarios en una transacción, lo saca de `/api/barberos`, de la asignación automática y de la reserva, y responde `citas_pendientes_conservadas`; esas citas siguen asignadas y se reasignan desde `/admin/citas`. `activo: true` reactiva el barbero y su usuario más reciente. Campos desconocidos → 400 `DATOS_INVALIDOS`; códigos: `USUARIO_DUPLICADO`, `EMPLEADO_NO_ENCONTRADO`, `ID_INVALIDO`, `PARAMETRO_INVALIDO`.
- **Completar citas**: solo si `fecha` ≤ hoy en Bogotá (admin y barbero); una cita futura se puede cancelar o reasignar, no completar.
- **`/admin/citas`**: todo el estado vive en la URL (`?pestana=&q=&desde=&hasta=&barbero=&pagina=`); un valor inválido se ignora. Cualquier filtro reinicia la página; una página inexistente lleva a la última válida; 15 citas por página; tras completar, cancelar o reasignar la lista se recarga conservando página y filtros.
- **Datos de demostración**: `seed:demo` marca a los clientes con `[demo] `, se niega con `NODE_ENV=production` o contra una base con "test" en el nombre, y solo escribe con `--confirmar`.

### Seed del catálogo

- `npm run seed` **solo inserta lo que falta** (`INSERT … ON CONFLICT DO NOTHING`): nunca hace UPDATE, nunca reactiva y nunca desactiva. Lo que el admin edite (precio, nombre, descripción, `activo`…) sobrevive a cualquier seed, y los servicios del admin (`clave_seed` nulo) no se tocan jamás. Las categorías y los 39 servicios salen de `backend/db/data/servicios.js` y `descripciones.js`; el `id` de esos archivos solo sirve para casar cada servicio con su descripción.
- Cada categoría y servicio de los datos lleva una `clave` **estable** (se guarda en `clave_seed`): `validarCatalogo` exige claves únicas y no vacías. Nunca cambies una clave publicada; así un servicio que el admin renombró no se vuelve a crear. Un servicio nuevo en el catálogo = una clave nueva.
- Pasos únicos (`backend/db/migracionesCatalogo.js`, registrados en `migraciones_aplicadas`, se ejecutan al arrancar el backend y al correr el seed): (1) asignar `clave_seed` a las filas existentes que coinciden con el catálogo (servicios por nombre, categorías por slug); (2) desactivar los 6 servicios del catálogo anterior, solo cuando el catálogo nuevo ya está en la base. Si ya estaban inactivos solo se registra; si el admin reactiva uno, nada lo vuelve a apagar.
- `npm run seed -- --restablecer-catalogo [--confirmar]` (solo desarrollo; se niega con `NODE_ENV=production`): vuelve las filas del catálogo a los datos de los archivos. Sin `--confirmar` solo muestra qué sobrescribiría.
- Los ids reales los asigna la secuencia, así que hay **huecos** y no coinciden con los de los archivos. No usar esos ids como referencia.
- Se puede correr las veces que haga falta sin duplicar ni pisar nada.

## Convenciones de código

- **No** importar `React` en componentes (React 19 no lo necesita).
- Importar **solo** de `react-router-dom`, nunca de `react-router`.
- Ningún dato repetido a mano en JSX: 3+ elementos similares van como array en `src/data/` (o vienen de la API) y se renderizan con `.map()`.
- Los servicios (nombre, descripción, precio, duración, tipo, categoría) tienen **una sola fuente de verdad**: la API. El front ya no deduce nada por nombre (se eliminaron `categoriasServicios.js` y `descripcionesServicios.js`).
- Precios siempre con `formatearPrecio` (`src/utils/formato.js`): da `$18.000` y "Gratis" si el precio es 0. Nunca formatear a mano.
- Catálogo y paso 1 de la reserva comparten `FiltrosServicios`, `useFiltroServicios`, `InsigniaTipo` (Original / Élite / VIP) y `TarjetaServicio`. Los filtros son botones con `aria-pressed` dentro de `role="group"` (no `role="tab"`); la lista se carga una vez y se filtra en el cliente. Los errores de carga usan `ErrorCarga` (`role="alert"` + "Reintentar").
- Responsive: en un contenedor `grid` que tenga hijos con scroll interno (`overflow-x-auto`), usar `grid-cols-1` y `min-w-0` en el hijo. Sin eso, la columna automática se estira al ancho del contenido y desborda la página en móvil. Medir con `scrollWidth` vs `clientWidth` en 360–414 px.
- Todas las llamadas HTTP pasan por `src/services/api.js`.
- "Hoy" en el front es siempre `hoyISO()` de `src/utils/fechas.js` (America/Bogota); no usar `new Date().toISOString()`.
- Totales de dinero (ingresos, ticket promedio) con `formatearDinero` (muestra `$0`); `formatearPrecio` es solo para el precio de un servicio (0 = "Gratis"). Las variaciones con `formatearDelta` (devuelve "—" sin base, nunca NaN ni ∞).
- Gráficos del dashboard: SVG propio, sin librerías, con colores y trazos en clases de Tailwind (`fill-oro`, `stroke-zinc-600`). Cada gráfico lleva `role="img"` + `aria-label` y una tabla de datos dentro de un `div` `sr-only` (una `<table>` suelta con `sr-only` ensancha la página).
- Listados del admin: el estado (pestaña, búsqueda, fechas, página) va en la URL con `useSearchParams`; los datos se piden con `useCarga` (conserva los datos mientras llegan los nuevos y descarta respuestas viejas).
- Toda imagen lleva `alt` descriptivo, nunca `alt=""`.
- La foto de un barbero se muestra siempre con `AvatarBarbero` (`src/components/ui`): si no hay foto o no carga, usa un avatar con iniciales hecho con clases de Tailwind. Los barberos creados desde el admin no tienen foto.
- Los listados ordenados por nombre se ordenan en el front con `localeCompare(…, 'es')` (así "Ángel" va antes de "Boby"), nunca con `<` ni con el orden del back-end.
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
- Dashboard del admin (en curso, por fases): hecho el layout con rutas hijas, el Resumen (indicadores con comparación, gráficos SVG, citas recientes) y `/admin/citas` (paginada, con filtros en la URL). También hecho: `/admin/servicios` (CRUD de servicios y categorías sin DELETE), el seed que solo inserta y `/admin/empleados` (crear, editar, activar/desactivar y restablecer contraseña). Falta el reporte diario.
- Pendiente (fuera de este trabajo): las asesorías gratuitas.
- Pendiente: Al terminar el dashboard: borrar las citas demo con seed:demo -- --limpiar.
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
