# CLAUDE.md

Contexto para Claude Code sobre el proyecto **Black Iron Barbers**. Léelo antes de proponer cambios.

## Qué es este proyecto

> Proyecto de portafolio con datos ficticios.

Sitio web de una **barbería** (solo servicios de barbería): catálogo de servicios, reserva de citas online y dos paneles privados:

- **Barbero** (`/panel`): ve y gestiona solo sus propias citas (Resumen con agenda de hoy y citas por confirmar; completar y cancelar es exclusivo suyo).
- **Administrador** (`/admin`): ve todas las citas (pendientes y realizadas), el barbero a cargo de cada una, gestiona servicios, categorías y empleados (barberos con su usuario) y consulta el reporte diario.

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
├── pages/              una página por ruta (pages/panel/ con PanelLayout + Resumen + MisCitas; pages/admin/ con AdminLayout + una página por sección)
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
- `usuarios`: `id`, `usuario` (único), `contrasena` (hash bcrypt), `rol` (`admin` | `barbero`), `barbero_id` (nulo para el admin), `activo`, `contrasena_cambiada_en` (TIMESTAMPTZ NOT NULL DEFAULT now(): último momento en que se fijó la contraseña; base de la caducidad de 60 días de los barberos; se escribe siempre desde Node, nunca con `NOW()`)
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
- **Caducidad de contraseñas (solo barberos; el admin está exento y cambia la suya cuando quiera).** Constantes en un solo lugar: `backend/utils/contrasenas.js` (`VIGENCIA_DIAS = 60`, `AVISO_DIAS = 2`, longitud 8–72) junto con `estadoContrasena()`.
  - Estado = `{ estado, dias_restantes, vence_en }`. `vence_en` = fecha de Bogotá del último cambio + 60 días (el primer día en que la contraseña ya no sirve); `dias_restantes` = días de **calendario** entre hoy (Bogotá) y `vence_en`. Se cuenta por fecha y no por bloques de 24 h para que el número no dependa de la hora del cambio ni de la zona del servidor (a las 22:00 de Bogotá ya es "mañana" en UTC). `vigente`: ≥ 3 · `por_vencer`: 1 o 2 · `caducada`: 0 o menos (día 57 vigente, 58 por_vencer, 60 caducada, contando el día del cambio como 0). Se calcula en Node (`fechaBogota()` de `utils/fechas.js`).
  - **El barbero no puede cambiar su contraseña cuando quiera**: solo con `por_vencer` o `caducada`; si no, 403 `CAMBIO_NO_PERMITIDO` (se aplica en el back-end, no solo ocultando el botón).
  - El administrador puede restablecer la contraseña de un barbero en cualquier momento (`PATCH /api/admin/usuarios/:id`). Eso, y crear un empleado o un acceso, deja `contrasena_cambiada_en` en "ahora" (reinicia los 60 días). Cambiar solo `activo` no lo toca. El barbero no está obligado a cambiarla al entrar.
  - Con la contraseña `caducada` el barbero **puede iniciar sesión**, pero `verificarToken` responde 403 `CONTRASENA_CADUCADA` en todo lo demás. Solo `GET /api/auth/sesion` y `PATCH /api/auth/contrasena` usan `verificarTokenPermitiendoCaducada`. Un usuario desactivado sigue dando 401 `SESION_INVALIDA` antes que cualquier otro bloqueo.
  - `PATCH /api/auth/contrasena` exige `actual` y `nueva` (8–72) distinta de la actual. Errores (todos con `codigo`): 403 `CAMBIO_NO_PERMITIDO`, 403 `CONTRASENA_CADUCADA` (otros endpoints), 400 `CONTRASENA_ACTUAL_INCORRECTA` (400 y no 401: un 401 con token cierra la sesión en el front), 400 `CONTRASENA_IGUAL`, 400 `DATOS_INVALIDOS` (con `campo`), 429 `DEMASIADOS_INTENTOS`. Tiene limitador propio: 5 intentos **fallidos** por usuario cada 15 min (los cambios correctos no cuentan), porque quien robe un token podría adivinar la contraseña actual a golpe de intentos. Como el de citas, se omite bajo `NODE_ENV=test` salvo `FORZAR_RATE_LIMIT_PRUEBA=true` (el login también).
  - El login devuelve `vigencia` (estado de la contraseña del barbero, `null` para el admin). `GET /api/admin/empleados` añade `usuario.vigencia` (nunca hashes). El campo se llama `vigencia` (y no "contraseña") para que ninguna respuesta lleve la palabra `contrasena`.
  - Front: `AuthContext` guarda `vigencia` (`undefined` = aún no se sabe tras recargar: `Panel` consulta `/auth/sesion`; `null` = no aplica). `/panel`: `por_vencer` → `AvisoCaducidad` (formulario solo desde ahí); `caducada` → `CambioObligatorio` (sin el resto del panel, con cerrar sesión). Un 403 `CONTRASENA_CADUCADA` en cualquier llamada lleva a esa pantalla (`setContrasenaCaducadaHandler` en `api.js`), no al login. El panel del barbero ya no tiene el cambio libre; el admin lo conserva en su menú de usuario. `/admin/empleados` muestra `IndicadorVigencia` (vigente, "Caduca en N días", caducada).

## API

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login` | público |
| GET | `/api/auth/sesion` | JWT (también con la contraseña caducada): `{ usuario, vigencia }` |
| PATCH | `/api/auth/contrasena` | JWT (también caducada). Barbero: solo `por_vencer` o `caducada` (si no, 403 `CAMBIO_NO_PERMITIDO`); admin: libre |
| GET | `/api/barberos`, `/api/disponibilidad` | público |
| GET | `/api/servicios`, `/api/servicios/:id`, `/api/categorias` | público (ver detalle abajo) |
| POST | `/api/citas` | público |
| GET | `/api/citas` | JWT; barbero ve solo las suyas, admin ve todas |
| PATCH | `/api/citas/:id` | JWT. **Completar y cancelar (`estado`) son exclusivos de los barberos**: el admin recibe 403 `SOLO_BARBERO` (aunque mande también `barbero_id`). Barbero: solo sus citas (si no, 404) y solo `estado` (reasignar → 403). Admin: solo reasignar (`barbero_id`). Completar solo si la fecha ≤ hoy (Bogotá): si no, 400 `CITA_FUTURA` |
| GET | `/api/barbero/resumen`, `/api/barbero/citas-por-confirmar`, `/api/barbero/agenda-hoy`, `/api/barbero/citas` | solo barbero (ver "Panel del barbero (API)") |
| GET | `/api/admin/estadisticas?periodo=hoy\|7d\|30d\|mes` | solo admin |
| GET | `/api/admin/estadisticas/ingresos?agrupar=dia\|mes` | solo admin |
| GET | `/api/admin/estadisticas/servicios-top?periodo=&limite=` | solo admin |
| GET | `/api/admin/citas?pestana=&q=&desde=&hasta=&barbero=&pagina=&limite=` | solo admin |
| GET | `/api/admin/reportes/diario?fecha=AAAA-MM-DD` | solo admin (JSON; sin `fecha` = hoy en Bogotá) |
| GET | `/api/admin/reportes/diario.csv?fecha=AAAA-MM-DD` | solo admin (mismo contenido en CSV, como descarga) |
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

- **Rutas** (`AppRouter`: `/admin` es un layout con rutas hijas lazy; el guard `ProtectedRoute` + `RoleRoute rol="admin"` está una sola vez en el padre): `/admin` (Resumen), `/admin/citas`, `/admin/servicios` (catálogo y categorías), `/admin/empleados` (barberos y su acceso) y `/admin/reportes` (reporte diario). Cualquier otra ruta bajo `/admin` vuelve a `/admin`. El buscador de la barra superior lleva a `/admin/citas?q=`.
- **Estadísticas** (todo bajo `/api/admin`, parámetros desconocidos/repetidos/inválidos → 400): "hoy" lo decide Node con `hoyISO()` de `backend/utils/fechas.js` (Bogotá), nunca `CURRENT_DATE`/`NOW()`. Ingresos = `SUM(citas.precio)` de las completadas (precio guardado en la cita). Las canceladas no suman y se cuentan aparte. El ticket promedio excluye las completadas de precio 0. Las series usan `generate_series(0, n)` sumado a una fecha (no dependen de la zona de la sesión de Postgres). `/estadisticas/ingresos` devuelve 30 días (o 12 meses) y los 30 (12) anteriores. Las consultas SQL viven en `backend/db/estadisticas.js`.
- **Lista de citas del admin** (`GET /api/admin/citas`): pestañas `proximas` (pendientes que aún no empiezan, las más cercanas primero), `todas` y `canceladas` (más recientes primero). Las pendientes de un día/hora pasados llevan `vencida: true` y no entran en `proximas`. Paginada: `limite` por defecto 10, máximo 50 (la pantalla pide 15). `q` busca en cliente, servicio y barbero (escapa `%`, `_` y `\`). `fecha`/`hora` salen como texto.
- **Catálogo del admin** (`adminCatalogoController.js`): sin DELETE (se activa o desactiva). Servicio: `nombre` 1–150 y único sin distinguir mayúsculas (solo se valida al crear o al cambiar el nombre, para no afectar filas ya existentes como "Exfoliación Facial"/"Exfoliación facial"), `precio` entero ≥ 0, `duracion_min` entero 1–600, `tipo` original/elite/vip, `categoria_id` existente y **activa**, `descripcion` obligatoria (máx. 500); campos desconocidos → 400; PATCH exige al menos un campo. Activar un servicio exige categoría activa, tipo y descripción (`SERVICIO_INCOMPLETO`). Categoría: slug generado del nombre (con sufijo `-2`, `-3`… si choca); desactivar una con servicios activos → 409 `CATEGORIA_CON_SERVICIOS`. Todos los errores llevan `codigo` estable (`DATOS_INVALIDOS` con `campo`, `NOMBRE_DUPLICADO`, `CATEGORIA_NO_DISPONIBLE`, `SERVICIO_INCOMPLETO`, `CATEGORIA_CON_SERVICIOS`, `SLUG_NO_EDITABLE`, `*_NO_ENCONTRADO`, `ID_INVALIDO`). Editar precio o duración no altera las citas ya creadas (guardan su propio precio y duración). `/api/servicios` y `/api/categorias` (públicas) solo muestran lo activo y nada de una categoría inactiva.
- **Empleados** (`adminEmpleadosController.js`): sin DELETE. `GET` devuelve, por barbero, `usuario` (`{ id, usuario, activo }` o `null`), `usuarios_total`, `cortes_mes` (completadas del mes en curso en Bogotá, con los límites calculados en Node) y `citas_pendientes` (pendientes que aún no empiezan). `POST` valida (`nombre` 1–100, `cargo` ≤ 100 y `especialidad` ≤ 150 opcionales, `usuario` 1–50, contraseña 8–72), hashea con bcrypt y crea barbero y usuario en una transacción: un usuario repetido responde 409 `USUARIO_DUPLICADO` y no deja un barbero huérfano. `PATCH` con `activo: false` apaga barbero y todos sus usuarios en una transacción, lo saca de `/api/barberos`, de la asignación automática y de la reserva, y responde `citas_pendientes_conservadas`; esas citas siguen asignadas y se reasignan desde `/admin/citas`. `activo: true` reactiva el barbero y su usuario más reciente. Campos desconocidos → 400 `DATOS_INVALIDOS`; códigos: `USUARIO_DUPLICADO`, `EMPLEADO_NO_ENCONTRADO`, `ID_INVALIDO`, `PARAMETRO_INVALIDO`.
- **Reporte diario** (`adminReportesController.js`): un solo día, sin desglose por barbero, con las mismas reglas que las estadísticas (reutiliza `resumenPeriodo` y `serviciosTop` de `db/estadisticas.js`). Respuesta: `fecha`, `total_cortes` (completadas), `ingresos` (SUM de `citas.precio` de las completadas: el precio de la cita, no el actual del servicio), `ticket_promedio` (excluye precio 0), `canceladas` (aparte, no suman), `pendientes_sin_cerrar` (todas las `pendiente` de ese día) y `servicios_mas_pedidos` (hasta 10, con `nombre`, `cantidad` e `ingresos`). Un día sin citas da ceros y lista vacía. Errores con `codigo`: `FECHA_INVALIDA` (formato o fecha inexistente como 2026-02-31), `FECHA_FUTURA` (se compara contra `hoyISO()` de Bogotá, calculado en Node) y `PARAMETRO_INVALIDO` (parámetro desconocido o repetido). El CSV (`utils/csv.js`) usa `;`, BOM UTF-8, CRLF, comillas dobles escapadas duplicándolas y neutraliza fórmulas (si una celda de texto empieza con `=`, `+`, `-`, `@`, tabulación o retorno se le antepone `'`); `Content-Type: text/csv; charset=utf-8` y `Content-Disposition: attachment; filename="reporte-diario-AAAA-MM-DD.csv"`.
- **Completar y cancelar citas**: solo los barberos, sobre sus propias citas (el admin responde 403 `SOLO_BARBERO`; solo puede reasignar, p. ej. al desactivar a un barbero). Completar solo si `fecha` ≤ hoy en Bogotá; una cita futura se puede cancelar (barbero) o reasignar (admin), no completar. En el dashboard del admin no queda ninguna vía para completar o cancelar: `/admin/citas` solo reasigna, y Resumen/citas recientes y el reporte son de lectura. Las pendientes de un día/hora pasados se marcan "Vencida" (informativo: las cierra el barbero); el aviso del reporte diario lo dice y enlaza a `/admin/citas`.
- **`/admin/citas`**: todo el estado vive en la URL (`?pestana=&q=&desde=&hasta=&barbero=&pagina=`); un valor inválido se ignora. Cualquier filtro reinicia la página; una página inexistente lleva a la última válida; 15 citas por página; tras reasignar la lista se recarga conservando página y filtros.
- **Datos de demostración**: se pueden crear y borrar a voluntad (ver Estado actual). `seed:demo` marca a los clientes con `[demo] `, se niega con `NODE_ENV=production` o contra una base con "test" en el nombre, y solo escribe con `--confirmar`.

### Panel del barbero (API)

- Rutas bajo `/api/barbero` (`routes/barbero.js`, `controllers/barberoController.js`, consultas en `db/barbero.js`), solo lectura, con `verificarToken` + `requiereRol('barbero')`: sin token 401, admin 403, contraseña caducada 403 `CONTRASENA_CADUCADA`, usuario desactivado 401 `SESION_INVALIDA`. No hay POST/PATCH/DELETE.
- **El `barbero_id` sale siempre de `req.usuario` (base de datos)**, nunca de query, body ni params. Ninguna de las tres rutas admite parámetros: cualquiera (conocido o no, repetido o `a[]=`) da 400 `PARAMETRO_INVALIDO`. Otros códigos: `SIN_BARBERO` (403, usuario de barbero sin barbero ligado).
- **Cita "por confirmar"**: pendiente cuyo **fin** (inicio + duración guardada en la cita, y si no hubiera la del servicio) **+ 2 horas** ya pasó, incluidos días anteriores. `fecha + hora + duración + gracia <= ahora`: en el instante exacto del límite ya cuenta, un minuto antes no. "Ahora" lo decide Node (`ahoraBogota()`) y llega como parámetro; la gracia vive en `backend/utils/confirmacion.js` (`HORAS_GRACIA_CONFIRMACION = 2`, `TOPE_POR_CONFIRMAR = 100`). La condición SQL está una sola vez en `db/barbero.js`.
- `GET /api/barbero/resumen` → `fecha` (hoy, Bogotá), `citas_hoy` (no canceladas), `completadas_hoy`, `pendientes_hoy`, `proxima_cita` (`{ id, cliente, servicio_nombre, fecha, hora }` de la pendiente más cercana que aún no empieza, hoy o días siguientes; o `null`), `ingresos_hoy`, `cortes_mes`, `ingresos_mes` (solo SUS completadas, precio guardado en la cita, mes en curso de Bogotá) y `por_confirmar`. Reutiliza `resumenPeriodo` de `db/estadisticas.js` (que ahora acepta un `barberoId` opcional).
- `GET /api/barbero/citas-por-confirmar` → `{ total, tope, items }`: sus vencidas de la más antigua a la más reciente (máx. 100; `total` es el conteo real), cada una con `id`, `cliente`, `servicio_nombre`, `fecha`, `hora`, `duracion_min`, `termino_hace_min` (desde que terminó la cita) y `vencida_hace_min` (desde que pasó el límite).
- `GET /api/barbero/agenda-hoy` → `{ fecha, citas }`: sus citas de hoy por hora (incluye canceladas) con `id`, `cliente`, `servicio_nombre`, `fecha`, `hora`, `estado`, `duracion_min`, `precio` y `por_confirmar`. Sin correo ni teléfono.
- `GET /api/barbero/citas?pestana=&q=&desde=&hasta=&pagina=&limite=` (lista paginada de "Mis citas"; `controllers/barberoController.js` → `listarMisCitas`, consulta en `db/barbero.js` → `listarCitasBarbero`). Solo sus citas (el `barbero_id` sale de `req.usuario`). Parámetros desconocidos o repetidos → 400 `PARAMETRO_INVALIDO`; valores inválidos → 400 `PARAMETRO_INVALIDO` con `campo` (`pestana`, `q` > 100 caracteres, `desde`/`hasta` no son fecha real o `desde` > `hasta`, `pagina` 1–1 000 000, `limite` 1–50). Sin POST/PATCH/DELETE (404).
  - `pestana` (por defecto `hoy`): `hoy` (de hoy, no canceladas, por hora) · `proximas` (pendientes que aún no empiezan, las más cercanas primero) · `por_confirmar` (regla de las 2 h, la misma condición SQL de `db/barbero.js`; de la más antigua a la más reciente) · `completadas` y `canceladas` (más recientes primero) · `todas` (más recientes primero). "Hoy" y "ahora" los decide Node (Bogotá) y llegan a SQL como parámetro.
  - `q` busca en cliente o nombre del servicio (ILIKE; `%`, `_` y `\` se escapan; solo espacios = sin filtro). `desde`/`hasta` son inclusivos. `limite` por defecto 10 (la pantalla pide 15).
  - Respuesta: `{ items, pagina, limite, total, conteos }`. `total` es el de la pestaña pedida; `conteos` = `{ hoy, proximas, por_confirmar, completadas, canceladas, todas }` con los MISMOS filtros `q`/fechas (lo que dice cada pestaña es lo que verás al abrirla). Una página fuera de rango devuelve `items` vacíos con el `total` (convención de `/api/admin/citas`; el front pasa a la última válida). Cada ítem: `id`, `cliente`, `servicio_nombre`, `duracion_min`, `fecha` y `hora` (texto), `estado`, `precio` (el de la cita) y `por_confirmar`. Sin correo ni teléfono.
- Distinto de `vencida` del admin (`GET /api/admin/citas`): allí es "la hora de inicio ya pasó" (informativo); "por confirmar" es la regla de arriba.

### Panel del barbero (front, `/panel`)

- **Rutas** (`AppRouter`): `/panel` es un layout con rutas hijas lazy; el guard `ProtectedRoute` + `RoleRoute rol="barbero"` está una sola vez en el padre. `/panel` (índice) = Resumen, `/panel/citas` = Mis citas (la lista de siempre, con completar y cancelar; se rediseña en la fase 4). Cualquier otra ruta bajo `/panel` vuelve a `/panel`. Menú lateral: solo Resumen y Mis citas (`data/menuBarbero.js`).
- **Layout compartido**: `components/admin/LayoutPanel.jsx` (rejilla, `BarraLateral`, `BarraSuperior`, cajón móvil con `useAtraparFoco`, `<Outlet />`) lo usan `AdminLayout` y `pages/panel/PanelLayout.jsx`. Lo propio de cada dashboard entra por props: `secciones`, `tarjeta` (bajo el logo), `centroBarra` (buscador del admin: `BuscadorCitas`), `derechaBarra` (`MenuUsuario`), `encabezado`, `superpuestos` y `espacioInferior`. `MenuUsuario` del barbero: `conCambioContrasena={false}` y solo "Cerrar sesión" (su contraseña únicamente se cambia desde el aviso de caducidad). La barra lateral del barbero lleva `PerfilBarbero` (avatar con iniciales, nombre y cargo, tomados de `GET /api/barberos` por `barbero_id`).
- **Prioridad en `PanelLayout`**: 1) contraseña caducada → `CambioObligatorio` (bloquea todo y no se piden datos); 2) ventana de bienvenida; 3) contenido. `AvisoCaducidad` (por vencer) sigue arriba del contenido.
- **Estado compartido** (`context/ResumenBarberoContext.jsx`, hook `useResumenBarbero`): una sola petición a `/api/barbero/resumen` y `citas-por-confirmar` (en paralelo) que usan la ventana de bienvenida, el aviso persistente y el Resumen. Se recarga con `recargar()` (tras completar o cancelar, también desde `/panel/citas`), al volver a la pestaña y cada 60 s con la pestaña visible. Cada ciclo cancela el anterior (`AbortController` + bandera `vigente`): sin respuestas fuera de orden ni peticiones tras desmontar; si un refresco falla se conservan los datos. `version` sirve de clave para recargar la agenda de hoy a la par. `api.js` acepta `signal` en `obtenerResumenBarbero`, `obtenerCitasPorConfirmar` y `obtenerAgendaHoy`.
- **`/panel/citas` ("Mis citas", `pages/panel/MisCitas.jsx`)**: lista paginada de `GET /api/barbero/citas`. Todo el estado vive en la URL (`?pestana=&q=&desde=&hasta=&pagina=`; un valor inválido se ignora, cualquier filtro reinicia la página, una página inexistente lleva a la última válida, 15 por página) con el hook `hooks/useFiltrosCitasUrl.js`, que comparte con `/admin/citas` (con `conBarbero`), igual que `PestanasCitas` (ahora con `pestanas` y `conteos`; `data/pestanasBarbero.js`), `FiltrosCitasAdmin` (sin `barberos` no hay selector de barbero) y `Paginacion`. Pestañas (botones con `aria-pressed` en un `role="group"`, no `role="tab"`) con conteo: Hoy, Próximas, Por confirmar (insignia naranja si > 0), Completadas, Canceladas y Todas. Escritorio (≥ 1280 px): tabla real (`caption`, encabezados, cliente como `th scope="row"`); por debajo, tarjetas (`components/panel/ListaMisCitas.jsx`). Completar/Cancelar con `useAccionesCita` (cancelar con `ModalConfirmar`); al terminar llama a `recargar()` del resumen compartido, y como la clave de carga incluye su `version` la lista se vuelve a pedir con la misma página y filtros (y también cada 60 s y al volver a la pestaña). El aviso persistente se actualiza al instante.
- **Resumen**: "Hola, <nombre>" y la fecha de hoy (Bogotá); 4 tarjetas (`TarjetaIndicador` con `nota`: citas hoy, ingresos hoy, cortes del mes, próxima cita); agenda de hoy (línea de tiempo por hora, insignia "Por confirmar"); sección "Por confirmar" (ancla `#por-confirmar`, con "mostrando N de TOTAL" si supera el tope). Completar y cancelar usan `PATCH /api/citas/:id` por `hooks/useAccionesCita.jsx`; cancelar pide confirmación con `ModalConfirmar` (no `window.confirm`) y los errores (p. ej. `CITA_FUTURA`) se muestran en pantalla. Los totales de dinero van con `formatearDinero` ($0, nunca "Gratis"); el precio de una cita, con `formatearPrecio`.
- **Ventana de bienvenida** (`VentanaBienvenida`, usa `Modal`): una vez por inicio de sesión. "Tienes N cita(s) para hoy" + próxima cita, o "Hoy no tienes citas agendadas"; aparte, las por confirmar de días anteriores (lista de hasta 5) con un botón que lleva a `/panel#por-confirmar`. La marca vive en `sessionStorage` (`utils/bienvenida.js`, todo con try/catch); `AuthContext` la borra en `login` y `logout`.
- **Aviso persistente** (`AvisoPorConfirmar`): fijo, sin botón de cerrar, visible en todo `/panel` mientras `resumen.por_confirmar > 0` ("No has confirmado N cita(s)" + "Confirmar ahora"); escritorio: tarjeta abajo a la derecha, móvil: franja inferior; `z-20` (bajo el cajón y los modales); `role="status"` `aria-live="polite"` (solo cambia el texto cuando cambia el número). Solo existe dentro de `/panel`.

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
- Descargas con token: el enlace directo no lleva el `Authorization`, así que el CSV se pide con `fetch` en `api.js` y se guarda con `guardarArchivo` (`src/utils/descarga.js`).
- Impresión: se hace con variantes `print:` de Tailwind (nada de CSS propio). `AdminLayout`, `BarraLateral` y `BarraSuperior` ya llevan `print:hidden`/`print:bg-white`; en una página imprimible, los controles llevan `print:hidden` y las tarjetas `print:bg-white print:text-black`.
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
- **Dashboard del admin: COMPLETO** (fases 1a, 1b, 1c, 2, 3 y 4): layout con rutas hijas y barra lateral; Resumen (indicadores con comparación, gráficos SVG, servicios más pedidos, citas recientes); `/admin/citas` (paginada, filtros en la URL); `/admin/servicios` (CRUD de servicios y categorías sin DELETE) con el seed que solo inserta; `/admin/empleados` (crear, editar, activar/desactivar y restablecer contraseña); `/admin/reportes` (reporte diario con selector de día, CSV e impresión).
- Las citas demo ya se borraron de la base de desarrollo. Se pueden volver a generar con `cd backend && npm run seed:demo -- --confirmar` (antes haz un `pg_dump`) y borrar con `npm run seed:demo -- --limpiar --confirmar`, que solo toca las de clientes `[demo] `.
- Pendiente: página de la asesoría gratis (el botón de "Reserva a tu manera" ya existe y apunta a `RUTA_ASESORIA` en `src/data/negocio.js`, provisional).
- Pendiente: `backend/tests/globalSetup.js` inserta barberos y servicios con id fijo sin avanzar la secuencia; sembrar con `RESTART IDENTITY` o hacer `setval` ahí (hoy cada prueba nueva lo hace por su cuenta).
- **Dashboard del barbero (en curso).** Fases 1 (caducidad de contraseñas), 2 (el admin ya no completa ni cancela; endpoints `/api/barbero/*`), 3 (layout de `/panel`, Resumen, ventana de bienvenida y aviso persistente) y 4 (`/panel/citas` con `GET /api/barbero/citas`) hechas. Pendiente:
  - **Fase 5:** Mi cuenta (contraseña) y rendimiento personal.
  - Al terminar todo el dashboard: borrar las citas demo (`cd backend && npm run seed:demo -- --limpiar --confirmar`) y desactivar los barberos de prueba "Prueba Fase3 A/B/C" (usuarios `prueba_f3a`, `prueba_f3b`, `prueba_f3c`).
- Pendiente: notificaciones por email/WhatsApp.
- Pendiente: checklist de despliegue (ver "Después: despliegue" en `checklist-sesiones.md`).
- Pendiente: revisar las fotos `hair_woman_*` que quedaron en `public/Hair` sin usar (no se borraron sin confirmación).
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
