# Despliegue y seguridad: pendientes

Lista práctica de lo que hay que hacer o decidir **antes de publicar** el sitio (proyecto de portafolio con datos ficticios). Nada aquí está activo por defecto en desarrollo. Los valores de las variables salen de `.env.example`; los reales van solo en el `.env` de producción o en el panel del hosting, nunca en el repositorio.

## 1. Imprescindible

- [ ] **`NODE_ENV=production`.** Sin él el arranque solo avisa en consola y se comporta como desarrollo. Con él se activan las exigencias de arranque (SMTP real, secretos fuertes, `FRONTEND_URL` con https) y HSTS.
- [ ] **Secretos propios, aleatorios y distintos:** `JWT_SECRET` y `EMAIL_VERIF_SECRET` (≥ 32 caracteres). Generar con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. El backend rechaza los débiles, los de ejemplo y los que estuvieron publicados en el repo. Cambiar `EMAIL_VERIF_SECRET` invalida los códigos y comprobantes en curso (no afecta a las citas).
- [ ] **Credenciales nuevas:** contraseña de Postgres y `ADMIN_PASSWORD` (≥ 12 caracteres, no trivial). La contraseña de Postgres que estuvo en el historial público se considera comprometida.
- [ ] **`FRONTEND_URL`:** un único origen, con https y sin barra final ni comodín. `VITE_API_URL` del front apunta al backend real, con https y terminando en `/api` (sin ese sufijo todas las llamadas dan 404).
- [ ] **Base de datos no expuesta.** En desarrollo Postgres y el backend se publican solo en `127.0.0.1`; en producción quitar `ports` del servicio de la base y publicar el backend únicamente a través de un proxy inverso con TLS.
- [ ] **Respaldo antes de migrar:** `pg_dump` (dentro del contenedor con `-f` y luego `docker cp`) y copia periódica de la base **y** del volumen `fotos_perfil_data`, fuera del repositorio. Los `.env` y los respaldos nunca se versionan.
- [ ] **Aplicar cambios con** `docker compose up -d --build backend_black_iron`. **Nunca `docker compose down -v`** (borra la base y las fotos de perfil).

## 2. Proxy y límites de intentos

- [ ] **`trust proxy` es configurable con `TRUST_PROXY`.** Detrás de un proxy hay que fijarlo al **número exacto de saltos** (entero ≥ 1): plataformas como Render o Railway van con `TRUST_PROXY=1` (verifícalo en su documentación; con una CDN delante del proxy serían 2). Vacío o ausente = no confiar (correcto sin proxy). El backend rechaza `true`, `*`, `all`, rangos de IP y cualquier valor no entero (no arranca): un valor permisivo dejaría al cliente falsear `X-Forwarded-For` y esquivar los límites. Sin configurarlo detrás de un proxy, `req.ip` es la IP del proxy: todos los clientes comparten el cupo de los límites por IP (login, códigos de correo, reservas) y un atacante podría bloquear a un barbero concreto. Comprobación: tras desplegar, provocar fallos de login desde dos redes distintas y ver que no se bloquean entre sí.
- [ ] **Base de datos gestionada: `DB_SSL` y `DATABASE_URL`.** Neon, Supabase, Render, etc. exigen SSL y suelen entregar una URL de conexión. `DB_SSL=true` (SSL verificando el certificado) es lo recomendado; si falla por una CA propia del proveedor, `DB_SSL=no-verify` cifra pero **no verifica la identidad del servidor** (expone a un intermediario activo): úsalo solo como último recurso. Por defecto es `false` y, en producción con un host que no es local, el arranque avisa (no bloquea: en una red privada es correcto). `DATABASE_URL`, si se define, tiene prioridad sobre `DB_*`; lleva la contraseña, así que va solo en el panel del hosting y el backend nunca la imprime (en los errores solo muestra host y base enmascarados). El `?sslmode=` de la URL se ignora: el SSL lo decide `DB_SSL`. `npm run seed` y `sembrar:demo` usan el mismo Pool y por tanto la misma configuración.
- [ ] **Limitadores en memoria.** Los límites por IP (login, cambio de contraseña, citas, comprobar, códigos de correo) viven en la memoria del proceso y se reinician con el servidor. Con más de una instancia hay que moverlos a un almacén compartido (p. ej. Redis). Los límites por correo (60 s entre códigos, 5 por hora, 5 intentos por código) están en la base y no se reinician.
- [ ] **Spam de códigos de verificación.** Cada IP puede provocar 20 correos por hora a destinatarios distintos, y los alias `+x` y los puntos de Gmail esquivan el tope por buzón. La mitigación real es un WAF, un CAPTCHA o un tope global en el hosting.

## 3. Correo y recordatorios

- [ ] **SMTP real.** `EMAIL_ENABLED=true` con `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `EMAIL_FROM`. Sin correo no se puede reservar (la verificación es obligatoria y solicitar el código responde 503). En producción el backend no arranca si falta o es inválido. Probar el arranque en el servidor antes de abrir al público.
- [ ] **Mailpit no va a producción** (está en el profile `dev`; no usar `--profile dev` en el servidor). Los valores por defecto del compose (`SMTP_HOST=mailpit`) solo sirven en desarrollo.
- [ ] **SPF y DKIM (y DMARC)** del dominio del remitente `EMAIL_FROM`, o los correos caerán en spam. Proveedor: Gmail con contraseña de aplicación (≈ 500 correos al día en total, compartidos entre confirmaciones, códigos y recordatorios) o un transaccional (Resend, Brevo).
- [ ] **Recordatorios (~24 h antes):** `RECORDATORIOS_ENABLED=true` **junto con** `EMAIL_ENABLED=true` (con el primero solo, el temporizador no arranca y se avisa en consola). Al activarlos por primera vez se enviarán a las citas pendientes que ya cumplan las reglas: revisar cuántas son antes.
- [ ] **Hosting siempre encendido.** El temporizador no corre mientras el servidor duerme (la recuperación tardía lo mitiga, no lo resuelve): usar un hosting siempre activo o un disparador externo. Usar **una sola instancia** del backend (cada instancia tendría su propio temporizador; el reclamo atómico evita duplicados, pero no se probó con varias).
- [ ] Los correos a profesionales siguen apagados: el sistema no guarda su correo.

## 4. Contenedor y front

- [ ] **Contenedor del backend sin root (hecho en el `Dockerfile`: `USER node`, uid 1000).** Un volumen **nuevo** montado en `/app/uploads` hereda el propietario `node`. Un volumen que **ya existía** es de root y la subida de fotos fallaría: darle propiedad **una sola vez** (no borra nada; ver el nombre real con `docker volume ls`): `docker run --rm -v <proyecto>_fotos_perfil_data:/app/uploads alpine chown -R 1000:1000 /app/uploads`. En plataformas con volúmenes gestionados (Railway, Render, Fly…) el volumen puede montarse como root o con otro propietario: hay que ajustarlo según su documentación (por ejemplo, ese mismo `chown` en un paso de arranque o desde su consola) y comprobar tras desplegar que se puede subir una foto de perfil.
- [ ] **Fotos de perfil en disco** (`backend/uploads`, volumen `fotos_perfil_data`): con varias instancias moverlas a un almacenamiento compartido.
- [ ] **Token de sesión en `localStorage`.** Si hubiera un XSS, se leería. Mitigación: CSP estricta en el hosting del front, más `X-Content-Type-Options`, `Referrer-Policy` y `frame-ancestors`. Migrar a cookie `HttpOnly` sería un rediseño. HTTPS obligatorio en el front.
- [ ] **Número de WhatsApp:** `VITE_WHATSAPP_NUMERO` en el entorno de producción (solo dígitos con indicativo). Sin él, el botón flotante apunta a un marcador de posición.
- [ ] **Rutas del SPA.** El hosting del front debe reescribir todas las rutas a `index.html` (React Router, SPA); sin eso, recargar `/cortes` o `/acceso` da 404.
- [ ] **Variables `VITE_*` en el build.** Se incrustan al compilar: cambiar `VITE_API_URL` (incluye el sufijo `/api`) o `VITE_WHATSAPP_NUMERO` exige reconstruir el front. El directorio raíz del proyecto en el hosting es `frontend/`.
- [ ] **Dependencias:** `npm audit` periódico en front y back. `bcryptjs` es JS puro y bloquea el bucle de eventos; con mucha carga, valorar `bcrypt` nativo o `argon2`.

## 5. Decisiones abiertas

- [ ] **`POST /api/asesorias/gratis/comprobar`** es un oráculo: responde si un correo o teléfono ya usó la asesoría gratis sin demostrar que sean de quien pregunta (solo lo frena el límite de 10 intentos por IP cada 15 min). Opciones: exigir el comprobante del correo antes de comprobar, o quitarlo y dejar que decida el `POST /api/citas` (409 `ASESORIA_GRATIS_YA_USADA`).
- [ ] **Cierre de sesión en el servidor.** Hoy es solo del cliente: el token vale hasta 8 h o hasta que suba `usuarios.version_token`. Un `POST /api/auth/logout` que lo incremente exigiría tocar el front.
- [ ] **Datos de demostración en línea.** La base de producción no debe llevar citas ficticias por defecto; decidir si el sitio público se publica con ellas (`npm run sembrar:demo`, que se niega con `NODE_ENV=production`, así que habría que sembrarlas por otro medio) o vacío (en producción se crean un admin y usuarios nuevos; la base de desarrollo no se migra).
- [ ] **Cuentas demo de bajo privilegio.** Si el portafolio deja probar los paneles, crear cuentas de barbero específicas para ello (el admin puede restablecerlas y desactivarlas) y no compartir nunca las credenciales del admin real. La contraseña de un barbero caduca a los 60 días.

## 6. Primer arranque sobre una base existente

- El esquema (`schema.sql`) es aditivo e idempotente y se aplica solo al arrancar el backend.
- La migración única **`personal-area-asesoria-v1`** marca a la asesora (nombre `Camila` y cargo `Asesora de Imagen`) con `area = 'asesoria'`. Si esa persona tiene citas abiertas (pendientes, o no canceladas de hoy en adelante), se aborta sin tocar nada, avisa en consola y se reintenta en el siguiente arranque. Sin esa fila queda pendiente.
- `npm run seed` inserta la categoría y las tres asesorías (y el personal en instalaciones nuevas); es idempotente.
- Las sesiones abiertas siguen valiendo hasta que su usuario cambie la contraseña.
