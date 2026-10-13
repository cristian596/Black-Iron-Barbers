# Black Iron Barbers

[![CI](https://github.com/cristian596/Black-Iron-Barbers/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cristian596/Black-Iron-Barbers/actions)

Aplicación web full-stack para una barbería con asesorías de imagen: catálogo de servicios, reserva de citas en línea con verificación de correo y dos paneles privados (barbero/asesora y administrador).

> **Proyecto de portafolio con datos ficticios.** El negocio, las personas, los teléfonos y los correos que aparecen no existen.
> Todavía no hay demo en línea; lo pendiente para publicarlo está en [docs/despliegue.md](./docs/despliegue.md).

<table>
  <tr>
    <td valign="top"><img src="docs/capturas/01-inicio-hero-escritorio.webp" width="640" alt="Portada de Black Iron Barbers en escritorio, con botones de reserva, horario y dirección"></td>
    <td valign="top"><img src="docs/capturas/01-inicio-hero-movil.webp" width="200" alt="Portada de Black Iron Barbers en móvil, con botones a ancho completo"></td>
  </tr>
</table>

## Qué hace

**Cliente (sin cuenta)**
- Consulta la carta de servicios, filtrable por categoría y nivel, y arma una selección de hasta 3 servicios con total de tiempo y precio.
- Reserva en tres pasos (servicios, profesional, fecha y hora) en bloques de 1 hora; puede elegir barbero o dejar que el sistema asigne uno libre.
- Puede añadir una asesoría de imagen a sus cortes en una sola reserva; la primera asesoría gratuita es de una por persona.
- Debe verificar su correo con un código de 6 dígitos y recibe confirmación con archivo de calendario (`.ics`) y un recordatorio previo.

**Barbero y asesora** (`/panel`)
- Ven solo sus propias citas: agenda de hoy, próximas, por confirmar, completadas y canceladas.
- Completar y cancelar citas es exclusivo de ellos; también ven sus estadísticas.
- La asesora usa el mismo panel con el vocabulario de su área y ve las reservas combinadas con un corte.

**Administrador** (`/admin`)
- Ve todas las citas y reasigna profesional; no completa ni cancela.
- Gestiona servicios, categorías y empleados (se desactivan, nunca se borran) y revisa los cambios de perfil.
- Consulta estadísticas y el reporte diario, con descarga en CSV.

## Capturas

Todas con datos ficticios y una base desechable.

### Sitio público

| | |
|---|---|
| <img src="docs/capturas/02-inicio-secciones-escritorio.webp" width="440" alt="Secciones de presentación y servicios de la página de inicio"><br>Secciones de presentación con acceso a la carta y a la asesoría gratuita. | <img src="docs/capturas/03-cortes-catalogo-escritorio.webp" width="440" alt="Catálogo de cortes con filtros y el carrito Tu selección con dos servicios"><br>Catálogo filtrable por categoría y nivel, con carrito de hasta 3 servicios y total de tiempo y precio. |
| <img src="docs/capturas/04-asesorias-escritorio.webp" width="440" alt="Página de asesorías de imagen con la asesoría gratuita"><br>Asesorías de imagen con precios y duraciones que vienen de la API. | <img src="docs/capturas/05-footer-escritorio.webp" width="440" alt="Pie de página con navegación, horario, dirección y contacto"><br>Pie de página con navegación, horario, dirección y contacto. |
| <img src="docs/capturas/03-cortes-carrito-movil.webp" width="200" alt="Panel deslizable Tu selección abierto en móvil"><br>En móvil el carrito es un panel inferior con el total y el botón de agendar. | |

### Reserva

| | |
|---|---|
| <img src="docs/capturas/06-reserva-servicios-escritorio.webp" width="440" alt="Paso 1 de la reserva: bloque opcional de asesoría y carta de cortes"><br>Paso 1: se puede añadir una asesoría opcional a los cortes en una sola cita. | <img src="docs/capturas/07-reserva-barbero-escritorio.webp" width="440" alt="Paso 2 de la reserva: elección de barbero o cualquier barbero, con resumen lateral"><br>Paso 2: el cliente elige barbero o deja que el sistema asigne al más libre. |
| <img src="docs/capturas/08-reserva-bloques-escritorio.webp" width="440" alt="Paso 3: calendario y bloques horarios de una hora, con algunos marcados como Completa"><br>Paso 3: los bloques llenos se marcan «Completa» y se asigna la primera hora libre. | <img src="docs/capturas/09-reserva-verificacion-escritorio.webp" width="440" alt="Ventana que pide el código de verificación de 6 dígitos"><br>Toda reserva exige verificar el correo con un código de 6 dígitos. |
| <img src="docs/capturas/10-reserva-exito-escritorio.webp" width="440" alt="Pantalla de cita agendada con éxito con el resumen de la reserva"><br>Confirmación con el resumen y el correo al que se envió. | <img src="docs/capturas/08-reserva-bloques-movil.webp" width="200" alt="Bloques horarios en móvil, en dos columnas, con varios marcados como Completa"><br>En móvil los bloques se reorganizan en dos columnas. |
| <img src="docs/capturas/10-reserva-exito-movil.webp" width="200" alt="Pantalla de cita agendada con éxito en móvil"><br>La confirmación también se ve completa en móvil. | |

### Correos

Capturados con Mailpit, la bandeja de desarrollo.

| | | |
|---|---|---|
| <img src="docs/capturas/11-correo-codigo.webp" width="290" alt="Correo con el código de verificación"><br>Código de verificación: vigencia de 10 minutos y de un solo uso. | <img src="docs/capturas/12-correo-confirmacion.webp" width="290" alt="Correo de confirmación de la cita con el archivo cita.ics adjunto"><br>Confirmación con los detalles y un archivo de calendario adjunto. | <img src="docs/capturas/13-correo-recordatorio.webp" width="290" alt="Correo de recordatorio previo a la cita"><br>Recordatorio automático antes de la cita. |

### Paneles

| | |
|---|---|
| <img src="docs/capturas/14-login-escritorio.webp" width="440" alt="Pantalla de acceso del personal con el formulario vacío"><br>Acceso privado para barberos y administración (sin enlaces públicos). | <img src="docs/capturas/15-admin-estadisticas-escritorio.webp" width="440" alt="Resumen del administrador con indicadores, gráfico de ingresos y servicios más pedidos"><br>Administrador: indicadores comparados, ingresos por día y servicios más pedidos por área. |
| <img src="docs/capturas/16-admin-citas-escritorio.webp" width="440" alt="Lista de citas próximas con filtros por profesional y área"><br>Gestión de citas con filtros, área y reasignación de profesional. | <img src="docs/capturas/17-admin-empleados-escritorio.webp" width="440" alt="Tabla de empleados con área, estado, vigencia de contraseña y carga del mes"><br>Empleados (barberos y asesores) con su acceso y estado. |
| <img src="docs/capturas/18-admin-servicios-areas-escritorio.webp" width="440" alt="Servicios filtrados por asesorías y lista de categorías"><br>Servicios y categorías organizados por área (barbería y asesoría). | <img src="docs/capturas/22-admin-cambios-perfil-escritorio.webp" width="440" alt="Configuración del administrador con un cambio de nombre de perfil por revisar"><br>El admin revisa los cambios de perfil sin afectar la web pública. |
| <img src="docs/capturas/19-panel-barbero-escritorio.webp" width="440" alt="Panel del barbero con cifras del día, agenda de hoy y citas por confirmar"><br>Cada barbero ve solo su agenda y puede completar o cancelar sus citas. | <img src="docs/capturas/20-panel-asesora-escritorio.webp" width="440" alt="Panel de la asesora de imagen"><br>La asesora tiene el mismo panel, con el vocabulario de su área. |
| <img src="docs/capturas/21-panel-asesora-citas-escritorio.webp" width="440" alt="Mis citas de la asesora con reservas combinadas"><br>Las reservas combinadas muestran la otra cita (barbería) de la misma reserva. | <img src="docs/capturas/16-admin-citas-movil.webp" width="200" alt="Citas del administrador como tarjetas en móvil"><br>En móvil la tabla de citas se convierte en tarjetas. |

## Decisiones técnicas

- **Doble reserva imposible desde la base.** Una restricción `EXCLUDE USING gist (barbero_id, rango)` (`citas_sin_solapamiento`) rechaza dos citas activas que se solapen para el mismo profesional; la API responde 409. No depende de comprobar antes de insertar. → `backend/db/schema.sql`
- **Una sola zona horaria.** «Hoy» y «ahora» los decide Node en America/Bogota, no el servidor ni el navegador; en el front se usa `hoyISO()` y los correos formatean con `Intl` en esa zona. → `backend/utils/fechas.js`, `frontend/src/utils/fechas.js`
- **Verificación de correo en todas las reservas.** Código de 6 dígitos (10 min, 5 intentos, solo se guarda su HMAC) que se canjea por un comprobante JWT firmado con un secreto distinto del de sesión. El comprobante es de un solo uso y se consume en la misma transacción que crea la cita. Hay límites por correo (en la base) y por IP. → `backend/utils/verificacionCorreo.js`
- **Correos tras el commit, sin romper la reserva.** Se disparan sin `await` después de responder, nunca lanzan y registran el correo enmascarado; todo texto de usuario se escapa y el `.ics` se genera a mano. → `backend/utils/notificaciones.js`, `backend/utils/ics.js`
- **Recordatorios con reclamo atómico.** Un único `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING` marca las citas del ciclo, con máximo 3 intentos; una reserva combinada genera un solo correo. → `backend/utils/recordatorios.js`
- **Seguridad en capas.** bcrypt para contraseñas; JWT HS256 de 8 h cuyo `v` (`version_token`) invalida sesiones al cambiar la contraseña o desactivar al usuario; el rol sale de la base en cada petición; limitador de login por IP y usuario; caducidad de contraseñas de barberos a los 60 días; cabeceras de seguridad; fotos de perfil validadas por firma de bytes; SQL siempre parametrizado. Tras una prueba de penetración propia del login y su entorno se corrigieron varios hallazgos. → `backend/utils/token.js`, `backend/middlewares/cabecerasSeguridad.js`
- **Permisos en el servidor.** Cada consulta del barbero se filtra por el `barbero_id` de la sesión, nunca por lo que envía el cliente, y las áreas (barbería/asesoría) se validan con restricciones y triggers. → `backend/routes/`, `backend/db/schema.sql`
- **Una fuente del horario.** El horario (10:00–20:00, todos los días, bloques de 1 h sobre una rejilla interna de 30 min) vive en el back y en el front, y un test falla si difieren; el back rechaza fuera de horario con `FUERA_DE_HORARIO`. → `backend/config/horario.js`, `frontend/src/data/negocio.js`, `frontend/src/tests/horarioCoherencia.test.js`

## Arquitectura

```mermaid
flowchart LR
    N[Navegador] --> F[Frontend React + Vite]
    F --> A[API Express]
    A --> P[(PostgreSQL)]
    A --> S[SMTP / Mailpit]
```

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, React Icons |
| Backend | Node.js 22, Express 5, `pg` 8, `bcryptjs` 3, `jsonwebtoken` 9, `nodemailer` 10, `express-rate-limit` 8 |
| Base de datos | PostgreSQL 15 |
| Pruebas | Vitest 5 + React Testing Library (front) · Vitest + Supertest (back) |
| Calidad | ESLint 10 en ambas carpetas, GitHub Actions |
| Infraestructura | Docker Compose (backend + Postgres; Mailpit en el perfil `dev`) |

## Cómo ejecutarlo

**Requisitos:** Node.js 22.12 o superior y Docker.

1. Copia las variables de entorno. El `.env` real no se versiona.
   ```bash
   cp .env.example .env
   ```
   Hay que sustituir los `changeme` por valores propios: credenciales de Postgres (`POSTGRES_*`, `DB_*`), `PORT`, `ADMIN_USER`, `ADMIN_PASSWORD`, `FRONTEND_URL`, `VITE_API_URL` y los secretos `JWT_SECRET` y `EMAIL_VERIF_SECRET` (distintos entre sí, aleatorios y de al menos 32 caracteres).
2. Levanta el backend y Postgres:
   ```bash
   docker compose up --build
   ```
3. Levanta el frontend (http://localhost:5173):
   ```bash
   cd frontend && npm install && npm run dev
   ```
4. Para poder reservar hace falta Mailpit y `EMAIL_ENABLED=true` en el `.env`, porque la verificación de correo es obligatoria y no hay forma de desactivarla. La bandeja queda en http://localhost:8025:
   ```bash
   docker compose --profile dev up -d mailpit
   ```
5. Siembra los datos (barberos, administrador inicial y catálogo; solo inserta lo que falta):
   ```bash
   cd backend && npm run seed
   ```
   Opcionalmente, y solo en desarrollo, citas de demostración (por defecto solo simula; `-- --confirmar` las crea):
   ```bash
   npm run sembrar:demo
   ```

**Acceso a los paneles:** el login está en `/acceso`, sin enlaces visibles. El administrador se crea con `ADMIN_USER` y `ADMIN_PASSWORD` del `.env`; los barberos y asesores los crea el administrador desde `/admin/empleados`.

**Pruebas y lint**
```bash
cd frontend && npm run lint && npm test
cd backend && npm run lint && npm test
```
El back necesita `backend/.env.test` (plantilla en `backend/.env.test.example`) apuntando a una base distinta de la de desarrollo, por ejemplo `black_iron_test`: los tests la crean, le aplican el esquema y la limpian.

## Estructura del repositorio

```
frontend/    App React + Vite (src/, public/); lee el .env único de la raíz
  src/{components,pages,routes,services,hooks,utils,data,tests}
backend/     API Express + PostgreSQL
  config/ routes/ controllers/ middlewares/ utils/ (reglas puras)
  db/        schema.sql (aditivo e idempotente), seeds y catálogo
  tests/     Vitest + Supertest contra una base aislada
docs/        despliegue, pruebas manuales y capturas
.github/     flujo de CI
```

## Calidad

- **Pruebas:** más de 2.700 automatizadas: 1.276 en el front (80 archivos) y 1.430 en el back (50 archivos; una más se omite). El back corre contra una base PostgreSQL real y aislada.
- **Lint:** ESLint en `frontend/` y `backend/`.
- **CI** ([ci.yml](./.github/workflows/ci.yml)): en cada push y pull request, con Node 22. El front ejecuta lint, build y tests; el back, lint y tests contra un servicio PostgreSQL 15.
- **Contenedor:** el `Dockerfile` del backend define un `HEALTHCHECK`.
- **Accesibilidad y responsive:** imágenes con `alt`, campos con `label` y diseño revisado entre 360 y 1440 px sin scroll horizontal.

## Documentación

- [docs/despliegue.md](./docs/despliegue.md): pendientes y decisiones antes de publicar.
- Pruebas manuales: [admin](./docs/pruebas-manuales-admin.md), [reservas](./docs/pruebas-manuales-reservas.md) y [servicios](./docs/pruebas-manuales-servicios.md).
- [CLAUDE.md](./CLAUDE.md): contexto del proyecto (reglas de negocio, seguridad y convenciones) para el asistente de código.

## Cómo se trabajó

Proyecto desarrollado con asistencia de Claude Code (Anthropic), con instrucciones y revisión manual del desarrollador. El contexto que usa el asistente está en [CLAUDE.md](./CLAUDE.md).

## Estado y próximos pasos

Detalle en [docs/despliegue.md](./docs/despliegue.md).

- Despliegue con `NODE_ENV=production`, secretos propios y TLS mediante proxy inverso.
- SMTP real con SPF/DKIM para los correos y recordatorios.
- Configurar `trust proxy`: hoy no lo está y los límites por IP dependen de ello.
- Mitigación de abuso de códigos de verificación (WAF o CAPTCHA) y limitadores compartidos si hay más de una instancia.
- Decidir los datos de demostración en línea y el oráculo de `POST /api/asesorias/gratis/comprobar`.

## Autor

Hecho por [@cristian596](https://github.com/cristian596).
