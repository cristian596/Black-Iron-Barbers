# ✅ Checklist de sesiones v2 — Black Iron Barbers

Cada sesión se abre en un **chat/sesión nueva** de Claude Code. Al terminar cada una, corre `/usage` y marca aquí lo que quedó hecho.

## Decisiones tomadas (no se revisan en cada sesión)

- Solo **barbería**: se elimina todo lo relacionado con servicios de mujer (uñas, pedicura, cortes de dama).
- **Cada barbero tiene su propio login** y existe un **login de administrador** aparte.
- El **administrador crea el usuario y la contraseña** de cada barbero. No hay registro público.
- **Dos dashboards**: `/panel` para el barbero (solo sus citas) y `/admin` para el administrador (todas las citas, pendientes y realizadas, con el barbero a cargo).
- Un solo login (`/acceso`); el frontend redirige según el rol del JWT. La ruta no tiene enlaces públicos (no aparece en el menú), lleva `noindex, nofollow` y está bloqueada en `robots.txt` junto con `/panel` y `/admin`.

## Lo que se corrige (resumen)

**Seguridad:** contraseña de Postgres expuesta en repo público · sin `.env` · CORS abierto · sin rate limiting · contraseñas sin hash.
**Back-end:** solo existe `GET /` · todo en un `index.js` · `fecha`/`hora` como `VARCHAR` · sin restricción anti doble reserva · sin validación · sin manejo de errores · servidor arranca aunque la BD falle.
**Front-end:** cero llamadas HTTP · login sin estado ni `onSubmit` · "Agendar Cita" sin `onClick` · correo sin `onChange` · 59 bloques repetidos en `Cortes.jsx` · 12+ en `Galeria.jsx` · 36 errores de ESLint · `react-router` y `react-router-dom` mezclados · `App.jsx` muerto · rutas `galery`/`ubication` · `<a href>` en vez de `<Link>` · sin `alt` ni `htmlFor` · `logo.png` de 1.2 MB · sin lazy loading · sin ruta 404.

---

## 🗓️ Día 1

### Sesión 1 — Seguridad y estructura del back-end (~45-60 min)
- [ ] Rotar la contraseña de Postgres (la anterior ya es pública). Cambiar también cualquier otro secreto que se haya usado igual.
- [ ] Crear `.env` con: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `FRONTEND_URL`.
- [ ] Crear `.env.example` con las mismas claves y solo placeholders.
- [ ] Agregar `.env` al `.gitignore`; si estaba trackeado, `git rm --cached .env`.
- [ ] Hacer que `docker-compose.yml` lea `${VARIABLE}` (sin credenciales escritas).
- [ ] Decidir con calma si se limpia el historial de git (`git filter-repo`); **no** hacerlo sin confirmación explícita.
- [ ] Crear estructura: `backend/config/env.js`, `db/connection.js`, `routes/`, `controllers/`, `middlewares/`, `app.js`.
- [ ] `config/env.js` valida las variables al arrancar y falla rápido con mensaje claro si falta alguna.
- [ ] `index.js` queda solo con el arranque; el puerto sale de `.env`.
- [ ] Si la BD no responde tras los reintentos, el servidor termina con error (no arranca a medias).
- [ ] Agregar `globals.node` a `eslint.config.js` para el back-end y corregir el `catch (err)` sin usar.
- [ ] Verificar: `docker compose up --build` y `GET /` responde.

### Sesión 2 — Base de datos y autenticación (~60 min)
- [ ] Escribir `db/schema.sql` con estas tablas:
  - `barberos` (`id`, `nombre`, `cargo`, `especialidad`, `foto`, `activo`)
  - `usuarios` (`id`, `usuario` UNIQUE, `contrasena` hash, `rol` = `admin`|`barbero`, `barbero_id` nulo para admin, `activo`)
  - `servicios` (`id`, `nombre`, `duracion_min`, `precio`) — solo barbería
  - `citas` (`id`, `cliente`, `correo`, `servicio_id`, `barbero_id`, `fecha` DATE, `hora` TIME, `estado` = `pendiente`|`completada`|`cancelada`, `creada_en`) con `UNIQUE (barbero_id, fecha, hora)`
- [ ] Migrar las tablas actuales sin perder datos útiles (`fecha`/`hora` de `VARCHAR` a `DATE`/`TIME`).
- [ ] Script `db/seed.js`: barberos que se quedan, servicios masculinos con precio y duración, y el admin con contraseña hasheada desde `.env`.
- [ ] `POST /api/auth/login` con `bcrypt.compare`; rechazar usuarios con `activo = false`.
- [ ] JWT con `id`, `rol` y `barbero_id`; expiración corta; secreto desde `.env`.
- [ ] Middlewares `verificarToken` y `requiereRol('admin')`.
- [ ] Rate limiting en el login (`express-rate-limit`).
- [ ] Middleware de errores central con respuestas `{ error: "mensaje" }`.
- [ ] Verificar con `curl`: login correcto, login incorrecto, token inválido, rol insuficiente.

---

## 🗓️ Día 2

### Sesión 3 — Endpoints de negocio (~60 min)
- [ ] `GET /api/barberos` (público, solo activos).
- [ ] `GET /api/servicios` (público).
- [ ] `GET /api/disponibilidad?barbero=&fecha=` (horas libres).
- [ ] `POST /api/citas` (público): valida `cliente`, `correo`, `servicio`, `barbero`, fecha no pasada y hora válida.
- [ ] Doble reserva: si Postgres lanza `23505`, responder `409` con mensaje claro.
- [ ] `GET /api/citas` (JWT): si el rol es `barbero`, filtrar por su `barbero_id` **desde el token**; si es `admin`, devolver todas. Incluir nombre del barbero y del servicio. Filtros opcionales: `estado`, `barbero`, `fecha`.
- [ ] `PATCH /api/citas/:id` (JWT): cambiar estado. El barbero solo si la cita es suya; el admin cualquiera (y puede reasignar barbero).
- [ ] `GET /api/admin/resumen` (admin): contadores por estado y por barbero.
- [ ] `POST /api/admin/usuarios` (admin): recibe `usuario`, `contrasena` (mínimo 8 caracteres) y `barbero_id`; guarda hash; nunca devuelve la contraseña.
- [ ] `PATCH /api/admin/usuarios/:id` (admin): resetear contraseña o desactivar (no borrar, para conservar historial).
- [ ] `PATCH /api/auth/contrasena` (JWT): el barbero cambia su propia contraseña.
- [ ] Todas las consultas parametrizadas (`$1, $2`), nunca concatenar strings.
- [ ] Restringir CORS a `FRONTEND_URL`.
- [ ] Verificar con `curl`: un barbero **no** puede ver ni modificar citas de otro.

### Sesión 4 — Front-end público conectado a la API (~60-75 min)
- [x] **Quitar servicios de mujer**: borrar `serviciosFemale.js`, secciones "Uñas" y "Pedicure" (y cualquier sección femenina) de `Cortes.jsx`, el bloque femenino de `ReservaCorte.jsx` y las fotos `hair_woman_*` de `Galeria.jsx`.
- [x] Borrar de `public/` las carpetas `CourtWoman`, `Nails`, `NailsThematic` y `Pedicura` (ver antes que ningún otro componente las use).
- [x] Revisar `barberos.js`: quitar al personal que solo atiende servicios femeninos y corregir el cargo ("Barbera" en nombres masculinos). Revisar también `NuestrosServicos.jsx` y `Promos.jsx` por textos femeninos (`Descripcion.jsx` se eliminó después).
- [x] Crear `src/services/api.js` con `VITE_API_URL` y manejo de errores.
- [x] Crear `.env.example` del front con `VITE_API_URL`.
- [x] `LoginBarberos.jsx`: `useState`, `onSubmit`, llamada al login, guardar el JWT, redirigir a `/admin` o `/panel` según el rol, mensaje de error visible.
- [x] `ReservaCorte.jsx`: cargar servicios y barberos desde la API, pedir horas libres, conectar el correo (`onChange`), `onClick` real en "Agendar Cita", estados de carga, confirmación y error (incluido el `409`).
- [ ] Verificar: una reserva hecha en la web aparece en la base de datos. *(pendiente: requiere levantar Postgres/Docker para probar en vivo)*

---

## 🗓️ Día 3

### Sesión 5 — Dashboards de barbero y administrador (~90-120 min)
*(Si no cabe en una ventana de 5 h: barbero primero, admin después.)*
- [ ] `AuthContext` (usuario, rol, login, logout) con el JWT.
- [ ] `ProtectedRoute` (redirige a login) y `RoleRoute` (redirige si el rol no corresponde).
- [ ] Componentes compartidos: `TablaCitas`, `TarjetaCita`, `BadgeEstado`, `FiltrosCitas`.
- [ ] **`/panel` (barbero):** citas de hoy, pendientes y realizadas, botones completar y cancelar, cambio de contraseña.
- [ ] **`/admin` (administrador):**
  - [ ] Contadores por estado y por barbero.
  - [ ] Tabla de **todas** las citas (pendientes y realizadas) con columna **barbero a cargo**.
  - [ ] Filtros por estado, barbero y fecha.
  - [ ] Completar, cancelar y reasignar barbero.
  - [ ] Sección "Barberos": lista, formulario para **crear usuario y contraseña**, resetear contraseña, desactivar.
- [ ] Botón cerrar sesión en ambos dashboards.
- [ ] Agregar ruta 404 en `AppRouter.jsx`.
- [ ] Agregar el botón "Barbero" al menú móvil de `NavBar.jsx`.
- [ ] Verificar: un barbero que intenta abrir `/admin` es redirigido.

---

## 🗓️ Día 4

### Sesión 6 — Limpieza, rendimiento, tests y CI (~90-120 min)
- [ ] Refactorizar `Cortes.jsx` para leer los servicios desde `/api/servicios` (una sola fuente de verdad) y renderizar con `.map()`.
- [ ] Refactorizar `Galeria.jsx` a un array en `src/data/` + `.map()`.
- [ ] Corregir el typo "TINTURA BARABA BIGEN".
- [ ] Borrar `App.jsx` (código muerto).
- [ ] Unificar en `react-router-dom`.
- [x] Renombrar rutas `galery` → `galeria` y `ubication` → `ubicacion` (después se eliminó `/ubicacion`, junto con `/carta-bebidas` y `Descripcion`).
- [ ] Cambiar `<a href='/'>` de `NavBar` por `<Link to='/'>`.
- [ ] Reemplazar el fondo externo de Unsplash del menú móvil por una imagen local.
- [ ] Limpiar los 36 errores de ESLint (`import React`, íconos y variables sin usar).
- [ ] `alt` descriptivo en todas las imágenes y `<label htmlFor>` enlazado a cada input.
- [ ] Comprimir `logo.png` (1.2 MB → menos de 150 KB, WebP).
- [ ] `loading="lazy"` en imágenes de galería y `React.lazy` + `Suspense` en rutas.
- [ ] Tests: Vitest + React Testing Library (login y reserva) y supertest (auth, citas, permisos por rol).
- [ ] GitHub Actions: lint + build + tests en cada push/PR.
- [ ] Actualizar `README.md` y `CLAUDE.md` con lo que cambió.

---

## 🚀 Después: despliegue
- [ ] Front-end en Vercel con `VITE_API_URL` apuntando al back-end.
- [ ] Back-end y PostgreSQL en Render o Railway (o un VPS con Docker Compose).
- [ ] Variables de entorno configuradas en el panel del hosting, nunca en el repo.
- [ ] CORS con el dominio real, HTTPS activo y `JWT_SECRET` distinto al de desarrollo.
- [ ] Copia de seguridad periódica de la base de datos.

## 📝 Notas de cuota
- Una sesión nueva por bloque; si se corta por el límite de 5 h, continúa en la misma cuando se reinicie.
- Revisa `/usage` al final de cada sesión y ajusta los días si hace falta.
- La sesión 2 (auth) y la 5 (dashboards) son las que más riesgo tienen de consumir una ventana completa.
