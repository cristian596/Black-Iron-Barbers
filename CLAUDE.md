# CLAUDE.md

Contexto para Claude Code sobre **Black Iron Barbers**. Léelo antes de proponer cambios.

## Qué es

> Proyecto de portafolio con **datos ficticios**. Nunca escribir datos reales (teléfonos, correos, números de WhatsApp, direcciones de personas): el repo es público.

Sitio de una **barbería** con asesorías de imagen: catálogo de servicios, reserva de citas online y dos paneles privados.

- **Barbero** (`/panel`): ve y gestiona solo sus citas; completar y cancelar es exclusivo suyo.
- **Administrador** (`/admin`): ve todas las citas, reasigna profesional, gestiona servicios, categorías y empleados, y consulta reportes. No completa ni cancela citas.
- **Asesora** = un `barberos` con `area='asesoria'` (mismo rol `barbero`, otro área). Solo atiende asesorías.
- Rutas públicas: `/`, `/cortes`, `/reservar-corte`, `/asesorias`. El login está en `/acceso` (sin enlaces visibles, `noindex`, bloqueado en `frontend/public/robots.txt`); no hay registro público ni servicios de mujer.

## Stack

- **Front:** React 19 + Vite + Tailwind CSS 4 + React Router 7 (`react-router-dom`) + React Icons.
- **Back:** Node + Express 5 + PostgreSQL 15 (`pg`) + `bcryptjs` + `jsonwebtoken` + `nodemailer`.
- **Tests:** Vitest + React Testing Library (front) · Vitest + Supertest contra una base aislada `black_iron_test` (back, usa `backend/.env.test`, nunca la base de desarrollo).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`, Node 22): lint, build y tests. **Local: Node 24.**
- **Infra:** Docker Compose (backend + Postgres; Mailpit en el profile `dev`).

## Estructura

```
backend/
├── index.js        arranque (valida config, planificador de recordatorios, apagado ordenado)
├── app.js          express, cors, rutas, errores (exporta crearApp() para tests)
├── config/         env, horario, negocio, correo, recordatorios, secretos, verificacion, entorno
├── db/             connection, schema.sql (aditivo e idempotente), seed, sembrarDemo, sembrarCatalogo, sembrarPersonal, migracionesCatalogo, estadisticas, data/
├── routes/ controllers/ middlewares/ utils/   una ruta por grupo; utils = reglas puras (fechas, áreas, correo, ics…)
└── tests/          globalSetup crea y siembra black_iron_test
frontend/
├── index.html, vite.config.js (envDir '..': lee el .env único de la raíz), eslint.config.js, package.json
├── public/         estáticos (robots.txt, imágenes)
└── src/
    ├── components/{layout,sections,ui,carrito,admin,panel,login,dashboard}
    ├── context/ hooks/ utils/ data/ (datos estáticos: arrays + .map())
    ├── pages/          una por ruta (pages/panel/, pages/admin/)
    ├── routes/         AppRouter (React.lazy + Suspense), ProtectedRoute, RoleRoute
    ├── services/api.js único lugar con llamadas HTTP
    └── tests/          mockean frontend/src/services/api.js
docs/               despliegue.md (pendientes de producción) y pruebas-manuales-*.md
```

## Comandos

| Comando | Qué hace |
|---|---|
| `cd frontend && npm run dev` / `build` | Front en desarrollo (5173) / build de producción |
| `cd frontend && npm run lint` | ESLint del front |
| `cd backend && npm run lint` | ESLint del back. Hay un lint en cada carpeta: correr SIEMPRE ambos si se tocaron las dos, antes de dar una tarea por terminada |
| `cd frontend && npm test` | Tests del front |
| `cd backend && npm start` / `npm test` | Back (necesita Postgres) / tests del back |
| `cd backend && npm run seed` | Barberos, admin inicial y catálogo; **solo inserta lo que falta**, nunca pisa lo editado. `-- --restablecer-catalogo [--confirmar]` solo en desarrollo |
| `cd backend && npm run sembrar:demo` | Citas demo del portafolio, solo desarrollo: simula; `-- --confirmar` borra y recrea las suyas; `-- --limpiar --confirmar` borra solo las suyas. Se reconocen por el correo `@demo.blackiron.example` |
| `docker compose up -d --build backend_black_iron` | Reconstruye el back. **Nunca `docker compose down -v`** (borra base y fotos de perfil) |
| `docker compose --profile dev up -d mailpit` | Bandeja de correo de desarrollo (http://localhost:8025) |

## Cómo trabajar

- **No hacer commits ni push** (ni `git add`/`git rm`): el desarrollador los hace a mano. Al terminar un bloque, indicar qué archivos cambiaron y detenerse.
- **Solo Tailwind**: nada de CSS propio ni estilos en línea (única excepción: las plantillas HTML de correo, que van en línea dentro de `plantillasCorreo.js`).
- **Responsive siempre** (verificar 360–1440 px sin scroll horizontal; controles táctiles ≥ 44 px).
- Tests **en secuencial y en primer plano**; si hay timeouts por carga, repetir sin carga antes de darlo por fallo.
- Validar también con **Node 22** (como la CI), p. ej. `npx -y node@22`, además de Node 24.
- Antes de terminar: `cd frontend && npm run lint` y `npm test`; y, si se tocó el back, `cd backend && npm run lint` y `npm test`.
- **No imprimir secretos** (valores de `.env`, contraseñas, tokens): al revisar variables de entorno mostrar solo los nombres de las claves.
- En pruebas de correo usar **solo Mailpit**, nunca un SMTP real.
- Para mover o renombrar archivos usar `Move-Item`/`Rename-Item` (PowerShell), sin `git mv`/`git add`/`git rm`; Git detecta los renombres al hacer commit.
- Base de desarrollo (`black_iron_db`): `pg_dump -f` dentro del contenedor + `docker cp` antes de escribir; SQL desde archivo `.sql`; borrar solo por id exacto; las citas originales (ids 1, 15, 16, 17, 449, 450 y 946) no se tocan.
- Si algo afecta seguridad, permisos, datos de la base o borra archivos, o no está claro, **preguntar** antes. Si es ambiguo y no afecta eso, elegir lo más estándar.
- Responder siempre en español.

## Convenciones de código

- No importar `React` en componentes. Importar solo de `react-router-dom`; navegar con `<Link>`/`<NavLink>`, nunca `<a href>` interno.
- 3+ elementos similares → array en `frontend/src/data/` (o de la API) con `.map()`; nada repetido a mano en JSX.
- Todas las llamadas HTTP pasan por `frontend/src/services/api.js`.
- Los servicios (nombre, precio, duración, tipo, categoría) tienen **una sola fuente de verdad: la API**; el front no deduce nada por nombre.
- Dinero: `formatearPrecio` (precio de un servicio; 0 = "Gratis") y `formatearDinero` (totales; muestra `$0`) de `frontend/src/utils/formato.js`. "Hoy" en el front: `hoyISO()` de `frontend/src/utils/fechas.js` (America/Bogota), nunca `toISOString()`.
- Strings de área/estado: usar `backend/utils/areas.js` y `frontend/src/utils/areas.js`, no repetir `'asesoria'`/`'barberia'`.
- Toda imagen con `alt` descriptivo; todo input con `<label htmlFor>`; la foto de un barbero siempre con `AvatarBarbero` (sin foto: iniciales).
- Listados ordenados por nombre: `localeCompare(…, 'es')` en el front.
- Gráficos del dashboard: SVG propio con clases de Tailwind, `role="img"` + `aria-label` y tabla en `div.sr-only`.
- Estado de listados del admin/barbero en la URL (`useSearchParams`); datos con `useCarga`.
- En un `grid` con hijos de scroll interno: `grid-cols-1` y `min-w-0` en el hijo.
- SQL siempre parametrizado (`$1, $2`), nunca concatenar.
- Los servicios y las citas **nunca se borran** (`activo=false`/estados): conservan el historial.

## Seguridad: reglas que no se negocian

- Ningún secreto, contraseña ni connection string en código ni en `docker-compose.yml`: todo en `.env` (no versionado) y `${VARIABLE}`. `.env.example` solo con placeholders. La contraseña de Postgres que estuvo en el historial público está comprometida.
- Contraseñas siempre con bcrypt (coste en `COSTO_BCRYPT`), 8–72 bytes, política en `utils/politicaContrasenas.js` (400 `CONTRASENA_DEBIL`); nunca se devuelven en ninguna respuesta.
- **JWT** HS256 fijado, 8 h, `exp` obligatorio (`utils/token.js`). `verificarToken` consulta la base en cada petición: usuario o barbero inactivo → 401 `SESION_INVALIDA`; el `rol` y el `barbero_id` salen de la base, no del token. El token lleva `v` = `usuarios.version_token`, que sube al cambiar/restablecer la contraseña y al desactivar; `PATCH /api/auth/contrasena` devuelve un token nuevo.
- Los permisos se aplican en el back-end (filtrar por el `barbero_id` de `req.usuario`, nunca por lo que mande el cliente). Validar cada body/query antes de tocar la base; ids con `leerIdEstricto`; errores 500 con textos fijos.
- CORS restringido a `FRONTEND_URL`; cabeceras de seguridad en `middlewares/cabecerasSeguridad.js`.
- **Limitador de login** (`routes/auth.js`): solo cuenta intentos fallidos; 10 / 15 min por IP + usuario normalizado y 100 / 15 min por IP; 429 `DEMASIADOS_INTENTOS` con `reintentar_en_seg`. Los limitadores viven en memoria. Se omiten solo bajo Vitest (`esEntornoDePruebas()`: `NODE_ENV=test` **y** `VITEST`).
- Contraseñas de **barberos** caducan a los 60 días (`utils/contrasenas.js`); solo pueden cambiarla `por_vencer`/`caducada`; caducada → 403 `CONTRASENA_CADUCADA` salvo `/api/auth/sesion` y `/api/auth/contrasena`. El admin está exento. El admin crea los usuarios; no hay registro público.
- Subida de foto de perfil: formato por firma de bytes (JPEG/PNG/WebP ≤ 2 MB), nombre UUID decidido por el servidor, servida con `nosniff` y CSP `sandbox`.
- No reescribir el historial de git sin confirmación explícita. No versionar `.env` reales.
- Pendientes de producción (trust proxy, secretos, SMTP, etc.): `docs/despliegue.md`.

## Invariantes de negocio

- **Horario 10:00–20:00, lunes a domingo, bloques de 1 h en la UI** (rejilla interna de 30 min). Fuente: `backend/config/horario.js` (back) y `HORARIO_ATENCION` en `frontend/src/data/negocio.js` (front); la dirección y el nombre del local también están en `backend/config/negocio.js` y `frontend/src/data/negocio.js`. **`frontend/src/tests/horarioCoherencia.test.js` falla si difieren**: al cambiar uno hay que tocar los dos. No escribir horas ni dirección a mano en otros sitios. `POST /api/citas` → 400 `FUERA_DE_HORARIO`. Agrupación en bloques: `frontend/src/utils/bloquesHorarios.js`.
- **Zona horaria America/Bogota** en todo: "hoy"/"ahora" lo decide Node (`utils/fechas.js`: `hoyISO`, `ahoraBogota`) y nunca `CURRENT_DATE`/`NOW()` ni la zona del servidor o del navegador; los correos formatean con `Intl` en Bogotá.
- **Verificación de correo obligatoria en TODAS las reservas** (`utils/verificacionCorreo.js`, `controllers/verificacionCorreoController.js`): código de 6 dígitos → comprobante JWT (secreto `EMAIL_VERIF_SECRET`, distinto de `JWT_SECRET`) de un solo uso que se consume en la misma transacción que crea la cita (`POST /api/citas` exige `verificacion_token`). No existe ningún bypass por variable de entorno. Validador único de correo: `utils/validarCorreo.js` (el front lo repite en `frontend/src/utils/correo.js`).
- **Correos tras el commit y sin romper la reserva** (`utils/notificaciones.js`): el controlador los llama sin `await` después de responder; nunca lanzan (se registran con el correo enmascarado). Eventos: cita creada, cancelada y cambio de profesional. Todo lo que escribe una persona se escapa (`plantillasCorreo.js`); `.ics` a mano (`utils/ics.js`). Apagados salvo `EMAIL_ENABLED=true`; las pruebas usan siempre el transporte en memoria. Los correos a profesionales están apagados (no existe su correo).
- **Recordatorios** (`utils/recordatorios.js`, `config/recordatorios.js`): correo al cliente ~24 h antes, solo con `RECORDATORIOS_ENABLED=true` y `EMAIL_ENABLED=true`; reclamo atómico (`FOR UPDATE SKIP LOCKED`), máx. 3 intentos, una reserva combinada = un correo. Excluye las citas con correo `@demo.blackiron.example`.
- **Áreas `barberia` / `asesoria`** (`utils/areas.js`): el área de una cita es la de su servicio principal; barberos solo hacen barbería y asesores solo asesorías (400 `PROFESIONAL_INCOMPATIBLE`; triggers en `schema.sql`). Una asesoría por reserva; una asesoría + corte crean DOS citas con el mismo `reserva_id` en una transacción. La asesoría gratis (`clave_seed='asesoria-gratis'`) es de una por persona (correo **y** teléfono, `identidadAsesoria.js`; 409 `ASESORIA_GRATIS_YA_USADA`).
- **Reserva con varios servicios** (máx. 3, tope de 240 min por cita para combos): `utils/serviciosCita.js` en el back (manda) y `frontend/src/utils/carrito.js` en el front. `cita_servicios` guarda el snapshot; `citas.duracion_min` y `citas.precio` son la suma. Todo total/precio se calcula en el servidor.
- **Doble reserva:** `EXCLUDE USING gist (barbero_id, rango)` donde `estado <> 'cancelada'` (`citas_sin_solapamiento`) → 409; no hay `UNIQUE (barbero_id, fecha, hora)`.
- **Estados** `pendiente | completada | cancelada`: los finales no cambian (409 `TRANSICION_INVALIDA`); completar solo si la fecha ≤ hoy (400 `CITA_FUTURA`). Una cita está "por confirmar" cuando pasó su fin + 2 h (`utils/confirmacion.js`).
- **Perfil del dashboard** (nombre/foto solo visibles en el panel; `nombre_perfil`, `foto_perfil`): no afecta nunca a la web pública ni a `barberos.nombre`/`foto`.

## Modelo de datos (resumen)

`barberos` (con `area`, `foto`, `activo`) · `usuarios` (`rol` admin|barbero, `barbero_id`, `activo`, `version_token`, `contrasena_cambiada_en`, `nombre_perfil`, `foto_perfil`) · `categorias` y `servicios` (`area`, `tipo` original|elite|vip, `clave_seed` = identificador estable del catálogo sembrado) · `citas` (+ `reserva_id`, `rango` generado, columnas `recordatorio_*`) · `cita_servicios` (líneas con snapshot) · `asesoria_gratis_usos` · `cambios_perfil` · `verificaciones_correo` / `verificaciones_usadas` · `migraciones_aplicadas` (pasos de datos de una sola vez, p. ej. `personal-area-asesoria-v1`). El esquema (`db/schema.sql`) se aplica solo al arrancar el back, aditivo e idempotente.

## Endpoints (por grupo, en `backend/routes/`)

- `/api/auth`: login, sesión, cambio de contraseña.
- `/api/barberos`, `/api/servicios`, `/api/categorias`, `/api/disponibilidad`: públicos (solo lo activo; filtros por `area`).
- `/api/citas`: `POST` público (con comprobante de correo); `GET`/`PATCH` con JWT (barbero ve las suyas; admin solo reasigna).
- `/api/verificacion-correo` y `/api/asesorias`: públicos con límites (solicitar/confirmar código; comprobar asesoría gratis).
- `/api/barbero`: solo rol barbero (resumen, agenda de hoy, por confirmar, mis citas, estadísticas propias).
- `/api/admin`: solo admin (estadísticas, citas, servicios, categorías, empleados, usuarios, reportes diario/CSV, revisión de cambios de perfil).
- `/api/perfil`: perfil efectivo, nombre y foto del dashboard (JWT).

## Notas

- `POST /api/asesorias/gratis/comprobar` es un oráculo conocido (decisión pendiente en `docs/despliegue.md`).
- Redes sociales y número de WhatsApp son provisionales (`'#'` y `PENDIENTE_NUMERO`; el número real va en `VITE_WHATSAPP_NUMERO`).
- Pruebas manuales por funcionalidad: `docs/pruebas-manuales-*.md`.
