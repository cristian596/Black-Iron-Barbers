# Pruebas manuales — dashboard del administrador

Requisitos: backend y Postgres arriba (`docker compose up`) y el front con `npm run dev` (http://localhost:5173). Entra en `/acceso` con el usuario admin del `.env` (`ADMIN_USER` / `ADMIN_PASSWORD`).

Las partes se amplían a medida que se entregan. Marca cada caso en los anchos 360, 375, 414, 768, 1024 y 1440 px (DevTools → modo responsive).

---

## Parte 1a — estructura (layout, rutas y menús)

### A. Rutas y protección

1. Sin sesión, abre `/admin`, `/admin/citas`, `/admin/servicios`, `/admin/empleados` y `/admin/reportes`. Esperado: te lleva a `/acceso` en todas.
2. Inicia sesión como **barbero** y abre `/admin/servicios`. Esperado: te devuelve a `/panel`.
3. Inicia sesión como **admin**. Esperado: entras en `/admin` (Resumen).
4. Abre `/admin/lo-que-sea`. Esperado: vuelve a `/admin`.
5. Recarga (F5) estando en `/admin/empleados`. Esperado: sigues en esa sección con la sesión activa.
6. Comprueba que ninguna página pública (`/`, `/cortes`, `/reservar-corte`) tiene un enlace a `/acceso`, `/panel` ni `/admin`.

### B. Barra lateral (escritorio, ≥ 1024 px)

1. Está fija a la izquierda con: Resumen, Citas, Servicios, Empleados, Reportes y, abajo, Cerrar sesión. No hay sección de clientes.
2. La sección actual aparece resaltada en dorado y solo una a la vez (Resumen no queda marcada cuando estás en Citas).
3. Con Tab recorres los enlaces y se ve el contorno dorado del foco.
4. **Cerrar sesión** te lleva a `/acceso`; al volver atrás (botón del navegador) no recuperas el panel.

### C. Menú móvil (< 1024 px)

1. Se ve el botón de hamburguesa; la barra lateral no se ve ni se puede enfocar con Tab.
2. Al pulsar la hamburguesa entra el cajón desde la izquierda con fondo oscurecido y el foco cae dentro (en "Cerrar menú").
3. Tab y Shift+Tab dan la vuelta dentro del cajón; no llegas al buscador ni a la página de atrás.
4. **Escape** cierra el cajón y el foco vuelve a la hamburguesa.
5. El botón X y el clic en el fondo oscuro también lo cierran.
6. Al elegir una sección, navega y el cajón se cierra solo.
7. Con el cajón abierto la página de atrás no hace scroll.

### D. Barra superior

1. **Buscador:** escribe `Pérez & Ñandú` y Enter. Esperado: vas a `/admin/citas?q=P%C3%A9rez+%26+%C3%91and%C3%BA`. Con el campo vacío o solo espacios: `/admin/citas` sin `q`. (El filtro de la lista se aplica en la parte 1c; en 1a solo se verifica la navegación.)
2. **Menú de usuario** (avatar con iniciales): se abre y cierra con clic, Escape (el foco vuelve al avatar) y clic fuera.
3. **Cambiar contraseña:** abre un diálogo; el foco queda dentro, Tab no escapa, Escape lo cierra y el foco vuelve al avatar. Prueba una contraseña actual incorrecta (mensaje de error), una nueva de menos de 8 caracteres y una confirmación distinta. Con datos válidos aparece "Contraseña actualizada correctamente"; cierra sesión y entra con la nueva (y restaura la anterior después).
4. En 360 px el avatar y el buscador caben en una sola fila sin desbordar.

### E. Contenido provisional

- **Resumen, Servicios, Reportes:** muestran un aviso de que la sección llega en una parte posterior.
- **Citas** y **Empleados:** conservan el comportamiento del panel anterior (resumen por estado/barbero, filtros y reasignar (completar y cancelar ya no son del admin: ver la fase 2 del dashboard del barbero); crear usuario de barbero, resetear contraseña, activar y desactivar). Verifica que sigan funcionando igual.

### F. Corrección de `hoyISO()` (zona horaria)

El panel del barbero (`/panel`) calcula "hoy" en America/Bogota. Para verlo, cambia la hora del sistema a las 22:00 y confirma que "Citas de hoy" muestra el día actual de Bogotá, no el siguiente.

### G. Responsive (medición)

En cada ancho, en la consola del navegador: `document.documentElement.scrollWidth <= document.documentElement.clientWidth` debe dar `true` en las cinco rutas, con el cajón abierto y con el diálogo de contraseña abierto.

---

## Parte 1b — Resumen (estadísticas, gráficos y citas recientes)

> **Back-end:** si cambias el código, reconstruye la imagen para que `localhost:5001` sirva los endpoints nuevos: `docker compose up --build -d backend` (al arrancar aplica `schema.sql` y crea `idx_citas_fecha_estado`). Los comandos usan el admin del `.env`.

```bash
API="http://localhost:5001/api"
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"usuario":"<ADMIN_USER>","contrasena":"<ADMIN_PASSWORD>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

### H. Endpoints (curl)

| Caso | Comando | Esperado |
|---|---|---|
| Sin token | `curl -i $API/admin/estadisticas` | 401 |
| Token de barbero | mismo con `Authorization: Bearer <token de un barbero>` | 403 |
| Tarjetas | `curl -H "Authorization: Bearer $TOKEN" "$API/admin/estadisticas?periodo=hoy"` | 200 con `periodo`, `anterior`, `actual`, `previo` (`citas`, `completadas`, `canceladas`, `ingresos`, `ticket_promedio`) |
| Períodos | `periodo=7d`, `30d`, `mes` | `anterior` tiene la misma cantidad de días (el mes se compara con el mismo tramo del mes anterior) |
| Período inválido | `periodo=semana`, `periodo=`, `periodo=hoy&periodo=7d` | 400 con `error` |
| Parámetro desconocido | `?x=1` | 400 |
| Ingresos | `$API/admin/estadisticas/ingresos?agrupar=dia` / `agrupar=mes` | 30 + 30 puntos (12 + 12 por mes), con ceros incluidos |
| Servicios top | `$API/admin/estadisticas/servicios-top?periodo=30d&limite=3` | solo completadas; `limite` entre 1 y 20 (0, 21, `abc`, `1.5` → 400) |
| Citas del admin | `$API/admin/citas?pestana=proximas&limite=3` | `{ items, total, pagina, limite }`; `fecha` como `AAAA-MM-DD`, `hora` como `HH:MM:SS` |
| Pestañas | `pestana=todas`, `canceladas` | "todas" trae lo más reciente primero; las pendientes de días pasados vienen con `vencida: true` y NO salen en `proximas` |
| Búsqueda | `q=%25`, `q=_`, `q=Ana` | `%` y `_` se buscan como símbolos, no como comodines; busca en cliente, servicio y barbero |
| Fechas | `desde=2026-02-31` o `desde=2026-10-05&hasta=2026-10-01` | 400 |
| Paginación | `limite=51`, `pagina=0` → 400; `pagina=99` → `items: []` con el `total` correcto | |
| Login con nombre | `curl -X POST $API/auth/login ...` | el token trae el claim `usuario` (decodifica la parte central del JWT) |

Reloj de Bogotá: entre las 7 pm y la medianoche, `periodo=hoy` debe seguir mostrando el día de Bogotá (no el siguiente en UTC).

### I. Pantalla `/admin` (Resumen)

1. **Nombre:** el avatar muestra tus iniciales y el menú el usuario real. Con un token anterior a este cambio (sesión abierta de antes) dice "Administrador"; vuelve a iniciar sesión para ver el nombre.
2. **Selector de período:** Hoy / 7 días / 30 días / Mes. El activo va en dorado. Debajo del título aparece "Comparado con … (rango)" y cambia al elegir otro período.
3. **Tarjetas:** Ingresos, Citas, Completadas, Canceladas y Ticket promedio, con cifras en negrita. El delta lleva flecha, porcentaje y color: subir ingresos es verde; subir canceladas es rojo. Si el período anterior no tiene datos se ve "—" (nunca NaN ni ∞).
4. **Ticket promedio:** una completada de precio 0 cuenta como completada pero no baja el promedio.
5. **Gráfico de ingresos:** barras doradas y línea punteada gris del período anterior; eje Y con 4 divisiones. "Por día" (30 días) y "Por mes" (12 meses).
   - Mouse: al pasar sobre una barra aparece el detalle (día, ingresos, cortes, "Antes").
   - Teclado: Tab entra al gráfico (una sola parada); ← → Inicio Fin recorren las barras; Escape cierra el detalle.
   - Móvil: tocar una barra abre el detalle; tocar fuera lo cierra.
   - Lector de pantalla: el gráfico se anuncia con un resumen y hay una tabla oculta con todos los datos.
   - Con "reducir movimiento" activado en el sistema no hay transiciones.
6. **Servicios más pedidos:** barras horizontales del período elegido (solo completadas); nombres largos se recortan con "…".
7. **Citas recientes:** pestañas Próximas / Todas / Canceladas, buscador (espera ~0,3 s tras dejar de escribir) y filtro por fecha. Las pendientes de un día pasado muestran "Vencida" y solo salen en "Todas". "Ver todas las citas" lleva a `/admin/citas` con los filtros en la URL.
8. **Estados:**
   - Cargando: textos "Cargando …".
   - Vacío: mensajes por panel; con filtros activos aparece "Limpiar filtros".
   - Error: apaga el backend (`docker compose stop backend_black_iron`) y recarga: cada panel muestra su error con "Reintentar"; enciéndelo y pulsa Reintentar.
9. **Móvil (360–414 px):** las tarjetas van de a dos (la quinta ocupa todo el ancho) y no hay scroll horizontal en toda la página.

### J. Datos de demostración (`seed:demo`) — solo desarrollo

> No se ejecuta solo ni en los tests normales. **Antes de usarlo, haz un respaldo de tu base de desarrollo** (`pg_dump`).
>
> **Estado actual:** al cerrar el dashboard las citas demo se borraron de la base de desarrollo (quedan solo las citas reales). Si quieres repetir las pruebas con volumen (paginación de 29 páginas, gráficos con datos), vuelve a generarlas con `npm run seed:demo -- --confirmar`; las cifras de las secciones siguientes (p. ej. "435 citas = 29 páginas") suponen que están generadas.

```bash
cd backend
npm run seed:demo                              # simulación: muestra cuántas citas crearía, no escribe
npm run seed:demo -- --confirmar               # crea las citas demo (~60 días atrás y 5 adelante)
npm run seed:demo -- --limpiar                 # simulación de la limpieza
npm run seed:demo -- --limpiar --confirmar     # borra SOLO las citas demo
```

Comprobaciones: (1) las citas demo tienen el cliente `[demo] Nombre`; (2) tus citas reales siguen intactas tras `--limpiar --confirmar`; (3) con `NODE_ENV=production` el comando se niega; (4) contra una base con "test" en el nombre se niega; (5) volver a sembrar sin limpiar pide limpiar primero; (6) las citas respetan horarios y no se solapan, y guardan el precio del servicio.

---

## Parte 1c — `/admin/citas`, completar solo citas de hoy o pasadas, y limpieza

> Reconstruye el back-end para que `localhost:5001` tenga los cambios: `docker compose up --build -d backend_black_iron`. Con los datos demo hay 435 citas = 29 páginas de 15.

### K. Endpoints (curl)

| Caso | Comando | Esperado |
|---|---|---|
| Resumen viejo retirado | `curl -i -H "Authorization: Bearer $TOKEN" $API/admin/resumen` | `404` (sin token `401`, con token de barbero `403`) |
| Completar cita futura (token del barbero dueño; el admin ya no puede, ver fase 2) | `curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"estado":"completada"}' $API/citas/<id de una cita futura>` | `400` `{"error":"No se puede completar una cita de una fecha futura","codigo":"CITA_FUTURA"}`; la cita no cambia. Igual con el token de su barbero |
| Completar una de hoy o pasada | mismo comando con una cita de hoy o anterior | `200` |
| Cancelar / reasignar una futura | `-d '{"estado":"cancelada"}'` o `-d '{"barbero_id":2}'` | `200` (el bloqueo es solo para completar) |
| Cita de otro barbero | PATCH con token de un barbero sobre la cita de otro | sigue `404` (primero se comprueba que la cita sea suya) |
| Paginación | `$API/admin/citas?limite=15&pagina=29` | 15 `items`, `total: 435`; `pagina=99` → `items: []` con el `total` |

Entre las 7 pm y la medianoche "hoy" sigue siendo el día de Bogotá: una cita de mañana (en Bogotá) no se puede completar aunque en UTC ya sea ese día.

### L. Pantalla `/admin/citas`

1. **Paginación:** 15 citas por página. Bajo la tabla: "Mostrando 1–15 de 435" y la barra. En escritorio: `Anterior`, números con puntos suspensivos (p. ej. `1 … 4 5 6 … 29`) y `Siguiente`; la página actual en dorado. En móvil: `Anterior · Página 2 de 29 · Siguiente`. `Anterior` queda deshabilitado en la primera página y `Siguiente` en la última.
2. **Teclado y táctil:** Tab recorre los botones, Enter los activa; cada botón mide al menos 44 px.
3. **URL:** al cambiar de página aparece `?pagina=N`; la página 1 no ensucia la URL. Pega la URL en otra pestaña (o F5): vuelves a la misma página y filtros. El botón atrás/adelante del navegador recupera la página anterior/siguiente.
4. **Al cambiar de página** la vista vuelve al inicio de la tabla.
5. **Filtros → página 1:** estando en la página 5 cambia de pestaña, escribe en el buscador, elige un barbero o una fecha: vuelves a la página 1.
6. **Página inexistente:** abre `/admin/citas?pagina=999`: te lleva a la última página (29). Valores raros (`?pagina=abc`, `?pestana=zzz`, `?desde=2026-02-31`) se ignoran sin romper la página.
7. **Orden:** "Todas" y "Canceladas" muestran lo más reciente primero; "Próximas", lo más cercano primero.
8. **Rango de fechas:** "Desde" no admite una fecha posterior a "Hasta" (y viceversa). "Limpiar filtros" aparece solo con filtros activos y quita búsqueda, barbero y fechas (conserva la pestaña).
9. **Estados:** cargando ("Cargando citas..."), vacío (`/admin/citas?q=zzzzzz` → "No hay citas que coincidan con los filtros." con "Limpiar filtros") y error (apaga el back-end y recarga: "No pudimos cargar las citas." con "Reintentar").
10. **Sin bloque "Resumen"** en esta página (vive en `/admin`). El filtro por barbero sigue.
11. **Acciones:** estando en la página 3 con un filtro, cambia el barbero de una cita pendiente: la lista se recarga y sigues en la página 3 con el mismo filtro. (Desde la fase 2 el admin ya no tiene **Completar** ni **Cancelar**: solo cambiar el barbero; ver la sección siguiente.)
12. **Móvil (360–414 px):** las citas son tarjetas (con las acciones, incluido reasignar) y no hay scroll horizontal.

### M. Contraseña propia del admin

En el menú de usuario → **Cambiar contraseña**, el botón "Guardar contraseña" es dorado (token `oro`). El panel del barbero (`/panel`) ya no tiene este menú: ver "Dashboard del barbero, fase 1" más abajo (el barbero solo cambia su contraseña cuando está por vencer o caducada, con el botón crema).

---

## Fase 2 — Servicios y categorías (`/admin/servicios`) y seed que solo inserta

> Antes de empezar: haz un `pg_dump` de tu base y reconstruye el back-end (`docker compose up --build -d backend_black_iron`). Al arrancar, el backend aplica el esquema y los dos pasos únicos de migración.

### N. Migración en tu base de desarrollo

```bash
docker exec black_iron_postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "SELECT clave FROM migraciones_aplicadas"
docker exec black_iron_postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "SELECT COUNT(*) FILTER (WHERE clave_seed IS NOT NULL) AS con_clave, COUNT(*) FILTER (WHERE activo) AS activos FROM servicios"
```

Esperado: dos filas (`catalogo-claves-seed-v1`, `catalogo-legado-desactivado-v1`), 39 servicios con clave, 39 activos (los 6 viejos siguen inactivos) y las citas intactas. Reiniciar el backend no cambia nada.

### O. Endpoints (curl, con el token del admin)

| Caso | Esperado |
|---|---|
| `GET $API/admin/servicios` / `?activo=false` / `?categoria=cortes` / `?q=%25` | incluye inactivos; los filtros se combinan; `%` y `_` se buscan literales |
| `POST $API/admin/servicios` con todos los campos válidos | `201` con el servicio (y `categoria`) |
| Nombre vacío o de más de 150, `precio` negativo/decimal/texto, `duracion_min` 0 o 601, `tipo` inventado, `descripcion` vacía o de más de 500, campo desconocido | `400` con `codigo: "DATOS_INVALIDOS"` y `campo` |
| `categoria_id` inexistente o de una categoría inactiva | `400` `CATEGORIA_NO_DISPONIBLE` |
| Nombre repetido (`corte clásico` vs `Corte clásico`) | `409` `NOMBRE_DUPLICADO` |
| `PATCH $API/admin/servicios/<id>` con `{"precio":19000}` | `200`; sin campos → `400`; id inexistente → `404` `SERVICIO_NO_ENCONTRADO` |
| Reactivar un servicio del catálogo anterior (ids 1–6) con `{"activo":true}` | `400` `SERVICIO_INCOMPLETO` hasta enviar también `categoria_id`, `tipo` y `descripcion` |
| `POST $API/admin/categorias` con `{"nombre":"Tintes y color"}` | `201`, slug `tintes-y-color` (si existe, `-2`, `-3`…); con `slug` en el cuerpo → `400` `SLUG_NO_EDITABLE` |
| `PATCH $API/admin/categorias/<id>` con `{"activo":false}` y la categoría con servicios activos | `409` `CATEGORIA_CON_SERVICIOS` (con `total_servicios`) |
| `curl -X DELETE $API/admin/servicios/10` y `/categorias/1` | `404` (no existe ningún DELETE) |
| Sin token / con token de barbero | `401` / `403` |
| `GET $API/servicios` y `GET $API/categorias` (públicos) | solo lo activo; una categoría inactiva no aparece |

Snapshot: edita el precio de un servicio con citas y comprueba en `GET $API/admin/citas` que esas citas conservan su precio y duración anteriores; una reserva nueva usa los actuales.

### P. Pantalla `/admin/servicios`

1. **Chips de categoría:** por defecto se ve una sola categoría (la primera con servicios), con "Todas" y las demás; las inactivas dicen "(inactiva)"; "Otros" reúne los servicios sin categoría (catálogo anterior). Con texto en el buscador se busca en todas las categorías. Filtros por tipo y estado; "Limpiar filtros".
2. **Escritorio (≥ 1280 px):** tabla (servicio, categoría, tipo, duración, precio, estado, editar). **Editar** y **Nuevo servicio** abren el formulario en un panel lateral junto a la tabla.
3. **Móvil y tablet (< 1280 px):** tarjetas con la insignia de tipo, el precio (`Gratis` si es 0), la duración, el interruptor Activo/Inactivo y **Editar**; el formulario se abre a pantalla completa (foco dentro, Escape lo cierra). Todos los controles miden al menos 44 px.
4. **Inactivos:** se ven atenuados y con la etiqueta "Inactivo".
5. **Formulario:** valida al enviar (nombre, categoría, tipo, precio entero ≥ 0, duración 1–600, descripción ≤ 500 con contador) y lleva el foco al primer error. Los errores del servidor salen en su campo: nombre repetido (`NOMBRE_DUPLICADO`), categoría inactiva (`CATEGORIA_NO_DISPONIBLE`). Solo se envían los campos que cambiaron.
6. **Desactivar** (interruptor en Activo) pide confirmación en un diálogo; **activar** es directo. Activar un servicio del catálogo anterior abre el formulario para completar categoría, tipo y descripción.
7. **Se ve de inmediato:** desactiva un servicio y abre `/cortes` y el paso 1 de `/reservar-corte` (ya no está); reactívalo (vuelve). Cambia un precio y comprueba `/cortes`.
8. **Categorías (sección plegable):** crear (el orden es opcional), renombrar, cambiar el orden, activar/desactivar. El identificador (slug) se muestra pero no se edita. Desactivar una con servicios activos muestra "tiene N servicio(s) activo(s)…" en el diálogo y no cambia nada.
9. **Estados:** cargando, vacío, error con "Reintentar" (apaga el back-end y recarga).

### Q. Seed que solo inserta

```bash
cd backend
npm run seed                                 # 0 insertados si ya está todo; no cambia nada que hayas editado
npm run seed -- --restablecer-catalogo       # simulación: lista qué sobrescribiría (nada si la base coincide)
npm run seed -- --restablecer-catalogo --confirmar   # vuelve las filas del catálogo a los datos de los archivos
NODE_ENV=production npm run seed -- --restablecer-catalogo --confirmar   # se niega
```

Comprobación: (1) edita en el panel el precio y el nombre de un servicio del catálogo, desactiva otro y reactiva uno de los viejos; (2) corre `npm run seed` y reinicia el backend: nada cambia (no se duplica el renombrado, no se reactiva ni se apaga nada); (3) `--restablecer-catalogo` lista exactamente esos cambios; con `--confirmar` los revierte y no toca los servicios que creaste tú.


## Fase 3 — Empleados (`/admin/empleados`)

Antes de empezar: respaldo de la base (`pg_dump`, fuera del repo). No hay cambios de esquema en esta fase.

### R. Endpoints (curl, con el token del admin)

```bash
API=http://localhost:5001/api
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"usuario":"admin_blackiron","contrasena":"..."}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
H="Authorization: Bearer $TOKEN"
```

| Caso | Esperado |
|---|---|
| `GET $API/admin/empleados` | todos los barberos (activos e inactivos) con `usuario`, `usuarios_total`, `cortes_mes`, `citas_pendientes`; sin hash; **una sola fila por barbero** aunque tenga varios usuarios (Davinson tiene 4) |
| `GET $API/admin/empleados?activo=true` o `?a=1&a=2` | `400` `PARAMETRO_INVALIDO` |
| `POST $API/admin/empleados` con `{"nombre":"Prueba Uno","usuario":"prueba_uno","contrasena":"clave-segura-1"}` | `201` con el empleado (`foto` nula, activo); puede iniciar sesión y aparece en `GET $API/barberos` |
| Mismo `usuario` otra vez | `409` `USUARIO_DUPLICADO`; `GET $API/barberos` no gana ninguna fila (sin barbero huérfano) |
| Nombre vacío o de más de 100, `cargo` > 100, `especialidad` > 150, `usuario` vacío o > 50, contraseña de < 8 o > 72, `activo`/`foto`/`rol` en el cuerpo | `400` `DATOS_INVALIDOS` con `campo` |
| `PATCH $API/admin/empleados/<id>` con `{"cargo":"Senior"}` | `200`; cuerpo vacío o campo desconocido → `400`; id inexistente → `404` `EMPLEADO_NO_ENCONTRADO` |
| `PATCH` con `{"activo":false}` | `200` con `citas_pendientes_conservadas`; ya no está en `GET $API/barberos`; su usuario queda inactivo; **su token deja de servir al instante** (`401` `SESION_INVALIDA`) aunque no haya expirado |
| `POST $API/citas` con `barbero_id` de un inactivo | `400`; sin `barbero_id` ("cualquier barbero") nunca lo asigna |
| `PATCH` con `{"activo":true}` | barbero y usuario activos otra vez; puede iniciar sesión; vuelve a `GET $API/barberos` |
| `PATCH $API/admin/usuarios/<id>` con `{"activo":true}` de un barbero inactivo, o `POST $API/admin/usuarios` para él | `409` `BARBERO_INACTIVO` (no se deja un usuario activo con su barbero inactivo) |
| `curl -X DELETE $API/admin/empleados/1` | `404` (no existe ningún DELETE) |
| Sin token / con token de barbero | `401` / `403` |

Cortes del mes: se cuentan las citas `completada` del mes en curso **en Bogotá**. A las 23:30 del último día del mes (ya es el mes siguiente en UTC) sigue contando el mes que termina; pasada la medianoche de Bogotá empieza el nuevo.

### S. Pantalla `/admin/empleados`

1. **Orden y filtros:** alfabético en español ("Ángel" antes que "Boby"). Por defecto solo **Activos** (los chips muestran el total de cada estado); "Inactivos" y "Todos". El buscador ignora mayúsculas y tildes y busca en nombre, cargo, especialidad y usuario. Sin paginación.
2. **Escritorio (≥ 1280 px):** tabla (empleado con avatar y usuario, cargo, estado, cortes este mes, citas pendientes, acciones). **Editar**, **Nuevo empleado** y **Contraseña** abren un panel lateral junto a la tabla.
3. **Móvil y tablet (< 1280 px):** tarjetas con avatar, cargo, usuario, cortes del mes, citas pendientes, el interruptor Activo/Inactivo y los botones; los paneles se abren a pantalla completa (foco dentro, Escape cierra). Todos los controles miden al menos 44 px.
4. **Avatar:** los barberos con foto la muestran; los demás (los creados aquí) llevan sus iniciales. Los inactivos se ven atenuados y con la etiqueta "Inactivo".
5. **Nuevo empleado:** nombre, cargo y especialidad (opcionales), usuario y contraseña (con ojo para verla). Valida al enviar con las mismas reglas del back-end y lleva el foco al primer error; "usuario ya existe" sale en el campo usuario.
6. **Editar:** solo nombre, cargo y especialidad; solo se envían los campos que cambiaron.
7. **Contraseña:** restablece la del usuario del empleado. Si un barbero no tiene usuario (Manuel y Rafa en tu base) el botón dice **Crear acceso** y pide usuario y contraseña. Si hay varios usuarios ligados, la fila indica "(+N más)".
8. **Desactivar** pide confirmación en un diálogo. Si tiene citas pendientes, el aviso dice cuántas y ofrece "Ver y reasignar sus citas", que abre `/admin/citas?barbero=<id>&pestana=proximas`; esas citas siguen asignadas hasta que las reasignes. **Activar** es directo.
9. **Efecto en la web:** desactiva a un barbero y comprueba que desaparece de "Nuestro Equipo" en `/`, del paso 2 de `/reservar-corte` y de "cualquier barbero"; reactívalo y vuelve. Un barbero nuevo (sin foto) aparece con su avatar de iniciales en `/` y en la reserva.
10. **Sesión del empleado:** inicia sesión como un barbero en otra ventana, desactívalo desde el admin y recarga su panel: te devuelve al login.
11. **Estados:** cargando, vacío, error con "Reintentar" (apaga el back-end y recarga).


## Fase 4 — Reporte diario (`/admin/reportes`)

Esta fase no cambia el esquema ni los datos (solo lecturas), así que no hace falta respaldo.

### T. Endpoints (curl, con el token del admin)

```bash
API=http://localhost:5001/api
H="Authorization: Bearer $TOKEN"        # token del admin, como en la sección R
curl -s "$API/admin/reportes/diario" -H "$H"                      # hoy (Bogotá)
curl -s "$API/admin/reportes/diario?fecha=2026-10-03" -H "$H"     # un día concreto
curl -s -i "$API/admin/reportes/diario.csv?fecha=2026-10-03" -H "$H"        # CSV con cabeceras
curl -s "$API/admin/reportes/diario.csv?fecha=2026-10-03" -H "$H" -o reporte.csv   # guardarlo
```

| Caso | Esperado |
|---|---|
| `GET $API/admin/reportes/diario?fecha=2026-10-03` | `200` con `fecha`, `total_cortes`, `ingresos`, `ticket_promedio`, `canceladas`, `pendientes_sin_cerrar` y `servicios_mas_pedidos` (`nombre`, `cantidad`, `ingresos`); no hay desglose por barbero |
| Un día sin citas (`?fecha=2020-01-01`) | `200` con ceros y `servicios_mas_pedidos: []` |
| `?fecha=2026-02-31`, `?fecha=hoy`, `?fecha=` | `400` `FECHA_INVALIDA` |
| `?fecha=` de mañana en Bogotá o de 2099 | `400` `FECHA_FUTURA` (a las 7 p. m. de Bogotá ya es "mañana" en UTC: debe seguir aceptando el día de Bogotá) |
| `?periodo=hoy`, `?fecha=...&fecha=...` | `400` `PARAMETRO_INVALIDO` |
| Sin token / con token de barbero | `401` / `403` |
| `curl -X DELETE $API/admin/reportes/diario` (también POST, PATCH) | `404` |
| Cambia el precio de un servicio y repite el reporte de un día pasado | no cambia: usa el precio guardado en cada cita |
| Compara con `GET $API/admin/estadisticas?periodo=hoy` | mismos cortes, ingresos, ticket promedio y canceladas |

CSV: la respuesta lleva `Content-Type: text/csv; charset=utf-8` y `Content-Disposition: attachment; filename="reporte-diario-2026-10-03.csv"`. El archivo empieza con el BOM (`xxd reporte.csv | head -1` muestra `efbb bf`), separa con `;` y termina cada línea con CRLF. Ábrelo en Excel: los acentos se ven bien y las columnas quedan separadas. Un servicio cuyo nombre empiece con `=`, `+`, `-` o `@` sale con una comilla delante (no se ejecuta como fórmula).

### U. Pantalla `/admin/reportes`

1. **Día:** por defecto hoy en Bogotá. "Día anterior" y "Día siguiente" cambian de a un día; "Día siguiente" está deshabilitado en hoy y el calendario no deja elegir días futuros (si escribes uno, vuelve a hoy). El día queda en la URL (`?fecha=`): recarga, copia el enlace y ábrelo en otra pestaña. Una fecha inválida o futura en la URL se ignora y muestra hoy.
2. **Cifras:** total de cortes, ingresos, ticket promedio (no cuenta los cortes gratis) y canceladas (aparte, no suman ingresos). **Servicios más pedidos** en una tabla.
3. **Aviso de citas sin cerrar:** en un día con citas pendientes (por ejemplo hoy en tu base de demostración) aparece "Hay N citas sin cerrar; el reporte solo cuenta las completadas." con el enlace "Ver las citas de este día", que abre `/admin/citas` filtrado a ese día. Completa una cita y vuelve: el número baja y las cifras suben.
4. **Estados:** cargando; día sin citas ("No hay citas registradas en este día."); error con "Reintentar" (apaga el back-end y cambia de día).
5. **Descargar CSV:** el botón baja `reporte-diario-AAAA-MM-DD.csv` del día que ves (el enlace directo no serviría: lleva token). Si falla, muestra el error.
6. **Imprimir:** el botón abre el diálogo de impresión. En la vista previa deben desaparecer la barra lateral, la barra superior, el selector de día y los botones; el fondo es blanco, el texto negro, y arriba sale "Black Iron Barbers · Reporte diario" con la fecha.
7. **Responsive:** a 360–414 px las cifras van en una columna, el selector y los botones caben sin desplazar la página y los controles miden al menos 44 px. Un nombre de servicio muy largo se parte en vez de ensanchar la página.
8. **Teclado y lector de pantalla:** todos los controles se alcanzan con Tab con foco visible; los botones tienen nombre ("Día anterior", "Día siguiente"); la tabla tiene título, encabezados y la primera columna como encabezado de fila.

---

## Dashboard del barbero, fase 1 — caducidad de contraseñas

Las contraseñas de los barberos duran 60 días; el admin está exento. Los pasos con "reloj" cambian la fecha guardada en tu base de desarrollo, así que no hace falta esperar. **Haz un `pg_dump` antes** y usa un barbero de prueba (por ejemplo `prueba_uno`), no uno real.

### V. Migración y endpoints (curl)

```bash
API=http://localhost:5001/api
ADMIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"usuario":"admin_blackiron","contrasena":"..."}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s -X POST $API/admin/empleados -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"nombre":"Prueba Uno","usuario":"prueba_uno","contrasena":"clave-segura-1"}'
BARBERO=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"usuario":"prueba_uno","contrasena":"clave-segura-1"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

| Qué haces | Qué debe pasar |
|---|---|
| Al arrancar el back-end por primera vez con este cambio | Todos tus usuarios quedan con `contrasena_cambiada_en` = ese momento (nadie caduca de golpe). Reiniciar de nuevo no la mueve |
| Login del admin | `"vigencia": null` |
| Login de `prueba_uno` recién creado | `"vigencia": {"estado":"vigente","dias_restantes":60,"vence_en":"…"}` |
| `curl -X PATCH $API/auth/contrasena -H "Authorization: Bearer $BARBERO" -H 'Content-Type: application/json' -d '{"actual":"clave-segura-1","nueva":"otra-clave-2"}'` con la contraseña vigente | `403` con `codigo: "CAMBIO_NO_PERMITIDO"` |
| Lo mismo con el token del admin | `200` (el admin cambia la suya cuando quiere; devuélvela después) |
| Simula "por vencer": `UPDATE usuarios SET contrasena_cambiada_en = now() - interval '58 days' WHERE usuario = 'prueba_uno';` y consulta `GET $API/auth/sesion` | `vigencia.estado = "por_vencer"`, `dias_restantes = 2` |
| El cambio de arriba, ahora | `200`; la fecha vuelve a "ahora" (`vigente`, 60 días) |
| Cambio con `actual` equivocada | `400` `CONTRASENA_ACTUAL_INCORRECTA` (no 401) |
| Cambio con `nueva` igual a `actual`, o de 7 o 73 caracteres | `400` `CONTRASENA_IGUAL` / `DATOS_INVALIDOS` |
| 6 intentos fallidos seguidos | el sexto responde `429` `DEMASIADOS_INTENTOS` (espera 15 min o reinicia el back-end) |
| Simula "caducada": `… now() - interval '60 days'`. Login | `200` con `vigencia.estado = "caducada"` |
| `curl $API/citas -H "Authorization: Bearer $BARBERO"` | `403` `CONTRASENA_CADUCADA`. Igual con cualquier otra ruta protegida |
| `GET $API/auth/sesion` y el cambio de contraseña con ese mismo token | funcionan; tras el cambio, `GET $API/citas` vuelve a dar `200` |
| Con el barbero caducado, el admin hace `PATCH $API/admin/usuarios/<id>` con `{"contrasena":"clave-nueva-3"}` | `200`; el barbero entra con la nueva, `vigente` con 60 días y sin obligación de cambiarla |
| `GET $API/admin/empleados` | cada `usuario` lleva `vigencia` (sin hashes) |
| Desactiva a `prueba_uno` y usa su token | `401` `SESION_INVALIDA` (sigue igual, aunque esté caducada) |

### W. Pantallas

1. **Vigente:** en `/panel` no hay aviso ni formulario de contraseña; tampoco existe la opción de cambiarla.
2. **Por vencer (2 días o menos):** arriba del panel sale "Tu contraseña caduca en N días. Cámbiala ahora." con el botón **Cambiar contraseña**, que despliega el formulario (contraseña actual, nueva y confirmación, con botón para mostrar/ocultar). Al guardar, el aviso desaparece y sale "Contraseña actualizada. La nueva vale 60 días." Un lector de pantalla anuncia el aviso.
3. **Caducada:** al entrar (o al recargar) solo ves "Tu contraseña caducó" con el formulario y **Cerrar sesión**; no hay citas ni nada más. Si estabas dentro y la contraseña caduca (cambia la fecha en la base y pulsa cualquier acción), la siguiente llamada te lleva a esa pantalla, no al login. Tras cambiarla entras al panel con normalidad.
4. **`/admin/empleados`:** cada barbero con acceso muestra un indicador discreto: "Vigente", "Caduca en N días" (ámbar) o "Caducada" (rojo), tanto en la tabla (escritorio) como en las tarjetas (móvil). Tras restablecer una contraseña desde **Contraseña**, el indicador vuelve a "Vigente". El formulario de restablecer avisa de que la nueva vale 60 días.
5. **Responsive:** a 360, 375, 414, 768, 1024 y 1440 px el aviso (cerrado y con el formulario abierto), la pantalla obligatoria y `/admin/empleados` no tienen scroll horizontal (`scrollWidth` = `clientWidth`).
6. **Limpieza:** desactiva o borra tu barbero de prueba y restaura la contraseña del admin si la cambiaste.

---

## Dashboard del barbero, fase 2 — el admin no completa ni cancela, y endpoints del barbero

No cambia el esquema ni los datos. Usa un barbero de prueba y citas de prueba; no cierres citas reales con curl.

### X. Completar y cancelar (curl)

```bash
API=http://localhost:5001/api
ADMIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"usuario":"admin_blackiron","contrasena":"..."}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
BARBERO=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"usuario":"prueba_uno","contrasena":"..."}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

| Qué haces | Qué debe pasar |
|---|---|
| `curl -X PATCH $API/citas/<id> -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"estado":"completada"}'` (también `cancelada`, o con `barbero_id` a la vez) | `403` `codigo: "SOLO_BARBERO"`; la cita no cambia |
| Lo mismo con `-d '{"barbero_id":2}'` | `200` (el admin sigue reasignando) |
| Con el token del barbero dueño: `{"estado":"completada"}` en una cita de hoy o anterior; `{"estado":"cancelada"}` en cualquiera | `200` |
| El barbero sobre la cita de otro barbero | `404` |
| El barbero con `{"barbero_id":2}` | `403` |
| Completar una cita futura (barbero dueño) | `400` `CITA_FUTURA` |

### Y. Endpoints del barbero (curl)

| Qué haces | Qué debe pasar |
|---|---|
| `curl $API/barbero/resumen -H "Authorization: Bearer $BARBERO"` | `200` con `fecha`, `citas_hoy`, `completadas_hoy`, `pendientes_hoy`, `proxima_cita`, `ingresos_hoy`, `cortes_mes`, `ingresos_mes`, `por_confirmar`: solo las cifras de ese barbero |
| `curl $API/barbero/citas-por-confirmar …` | `{ total, tope: 100, items }`: sus pendientes cuyo fin + 2 h ya pasó, de la más antigua a la más reciente, con `termino_hace_min` y `vencida_hace_min` |
| `curl $API/barbero/agenda-hoy …` | `{ fecha, citas }` por hora, con estado, servicio, duración, precio y `por_confirmar` |
| Cualquier parámetro: `?barbero_id=2`, `?fecha=…`, `?x=1&x=2` | `400` `PARAMETRO_INVALIDO`: el barbero nunca se elige desde el cliente |
| Sin token / con el token del admin | `401` / `403` |
| Con la contraseña caducada (ver la fase 1) | `403` `CONTRASENA_CADUCADA` |
| Con un usuario desactivado | `401` `SESION_INVALIDA` |
| Regla de las 2 horas: crea una cita pendiente de hoy que terminó hace menos de 2 h y otra que terminó hace más | solo la segunda aparece en `citas-por-confirmar`; al completarla (como barbero) desaparece |

### Z. Pantallas

1. **`/admin/citas`:** ya no hay botones **Completar** ni **Cancelar** (ni diálogo de confirmación). En una cita pendiente solo queda el selector para reasignar. Las pendientes de un día pasado muestran la etiqueta **Vencida**.
2. **`/admin/reportes`:** con citas pendientes, el aviso dice "Hay N citas sin cerrar: las cierran los barberos, y el reporte solo cuenta las completadas." y el enlace "Ver las citas de este día" sigue llevando a `/admin/citas` filtrado a ese día.
3. **Resumen y citas recientes:** siguen de solo lectura.
4. **Responsive:** a 360, 375, 414, 768, 1024 y 1440 px, `/admin/citas` con citas vencidas y `/admin/reportes` con el aviso no tienen scroll horizontal (`scrollWidth` = `clientWidth`).

---

## Dashboard del barbero, fase 3 — layout, Resumen, bienvenida y aviso persistente

> **Estado de la base de desarrollo:** al cerrar el dashboard se borraron las citas demo y se desactivaron los barberos `prueba_f3a`, `prueba_f3b` y `prueba_f3c`. Las cifras de ejemplo de esta sección (totales, páginas, ingresos) salen de una base con citas demo generadas: con la base limpia verás listas y gráficos casi vacíos (es correcto: comprueba los estados vacíos). Para regenerarlas: `pg_dump`, `cd backend && npm run seed:demo -- --confirmar`; para borrarlas: `npm run seed:demo -- --limpiar --confirmar`. Los barberos de prueba se reactivan desde `/admin/empleados` (o crea uno nuevo y restablece su contraseña).

Solo front-end. Necesitas citas: haz un `pg_dump`, corre `cd backend && npm run seed:demo` (simulación) y luego `npm run seed:demo -- --confirmar`. Entra como un barbero con usuario (el admin puede restablecer la contraseña de uno de prueba). Las citas demo se borran al final de todo el dashboard.

### AA. Layout (`/panel`)

1. La barra lateral muestra el avatar (iniciales si no hay foto), el nombre y el cargo del barbero, y solo **Resumen** y **Mis citas**. La barra superior solo trae el menú de usuario con **Cerrar sesión** (sin cambiar contraseña).
2. `/panel/citas` abre la lista de siempre (completar y cancelar funcionan) dentro del mismo layout. `/panel/lo-que-sea` vuelve a `/panel`. Sin sesión, `/panel` lleva a `/acceso`; un admin que abre `/panel` vuelve a `/admin`.
3. **Móvil (< 1024 px):** el botón de menú abre un cajón; el foco queda dentro, Tab da la vuelta, Escape o el fondo lo cierran y el foco vuelve al botón.
4. **Prioridad:** con la contraseña caducada solo ves la pantalla obligatoria de cambio (sin ventana ni datos); con la contraseña por vencer, el aviso de caducidad sigue arriba del contenido.
5. `/admin` se ve y funciona igual que antes (misma barra lateral, buscador y menú).

### AB. Resumen (`/panel`)

1. "Hola, <nombre>" y la fecha de hoy. Cuatro tarjetas: **Citas hoy** (con las completadas), **Ingresos hoy**, **Cortes del mes** (con sus ingresos) y **Próxima cita** (cliente, servicio y hora; con la fecha si es de otro día; "Sin citas próximas" si no hay). Un total en cero se ve como `$0`, nunca "Gratis".
2. **Agenda de hoy:** línea de tiempo por hora con estado, servicio, duración y precio, y la insignia **Por confirmar** cuando la cita ya terminó hace más de 2 h y sigue pendiente. Solo las pendientes tienen **Completar** y **Cancelar**.
3. **Cancelar** abre un diálogo de confirmación propio (no el del navegador). Completar una cita futura muestra el mensaje del back-end en pantalla.
4. **Por confirmar:** tus vencidas de la más antigua a la más reciente, con "Vencida hace …" y las mismas acciones; si hay más del tope (100) dice "Mostrando N de TOTAL".
5. Estados: esqueletos al cargar; si apagas el back-end, "No pudimos cargar tu resumen." con **Reintentar**; sin citas, "Hoy no tienes citas agendadas." y "No tienes citas por confirmar. Todo está al día."
6. **Refresco:** tras completar o cancelar todo se recarga. Con el panel abierto, cambia a otra pestaña y vuelve: se actualiza. También cada 60 s con la pestaña visible (en las herramientas de red verás una sola ronda de `resumen` + `citas-por-confirmar` por ciclo, no una por componente).

### AC. Ventana de bienvenida

1. Al iniciar sesión (después del cambio de contraseña si estaba obligado) sale una ventana: "Tienes N cita(s) para hoy." y la próxima cita, o "Hoy no tienes citas agendadas.". Si tienes por confirmar de días anteriores, aparecen aparte ("Tienes N citas sin confirmar de días anteriores", con la lista) y el botón **Ver citas sin confirmar** te lleva a esa sección con el foco en su título.
2. **Entendido**, Escape, la X o el fondo la cierran y el foco vuelve a donde estaba.
3. Sale **una vez por inicio de sesión**: recarga la página (F5) y no vuelve; cierra sesión y entra de nuevo y sí. (En DevTools → Application → Session Storage: clave `bienvenida-barbero-vista`.)
4. No aparece en `/admin` ni en las páginas públicas.

### AD. Aviso persistente de citas por confirmar

1. Con citas por confirmar, en **todas** las rutas de `/panel` hay un aviso fijo: "No has confirmado N cita(s)" con **Confirmar ahora** (lleva a `/panel#por-confirmar`). No tiene botón de cerrar.
2. Escritorio: tarjeta abajo a la derecha; móvil: franja inferior. No tapa el menú de usuario, la barra superior ni el menú lateral, y al final de la página el contenido deja espacio libre debajo.
3. Queda por debajo del cajón y de los diálogos.
4. Desaparece solo cuando completas o cancelas la última cita por confirmar. Lector de pantalla: se anuncia solo cuando cambia el número.

### AE. Responsive (API real)

A 360, 375, 414, 768, 1024 y 1440 px no hay scroll horizontal (`scrollWidth` = `clientWidth`) en: Resumen con datos, Resumen vacío, ventana de bienvenida (con y sin por confirmar), aviso persistente (escritorio y móvil), `/panel/citas` y el cajón abierto; y los botones, enlaces, selectores y campos miden al menos 44 px de alto.

---

## Dashboard del barbero, fase 4 — Mis citas (`/panel/citas`)

> **Estado de la base de desarrollo:** al cerrar el dashboard se borraron las citas demo y se desactivaron los barberos `prueba_f3a`, `prueba_f3b` y `prueba_f3c`. Las cifras de ejemplo de esta sección (totales, páginas, ingresos) salen de una base con citas demo generadas: p. ej. "Mostrando 1–15 de 28" es un ejemplo, no lo que verás. Regenera las citas con `seed:demo` (ver la fase 3).

No cambia el esquema. Necesitas citas (ver la fase 3: `seed:demo`). Entra con un barbero que tenga varias.

### AF. Endpoint (curl)

```bash
API=http://localhost:5001/api
BARBERO=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"usuario":"prueba_f3a","contrasena":"..."}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s "$API/barbero/citas?pestana=completadas&limite=5&pagina=2" -H "Authorization: Bearer $BARBERO"
```

| Qué haces | Qué debe pasar |
|---|---|
| `GET $API/barbero/citas` | `200`: pestaña `hoy`, `{ items, pagina: 1, limite: 10, total, conteos }`; cada ítem con `id`, `cliente`, `servicio_nombre`, `duracion_min`, `fecha`, `hora`, `estado`, `precio`, `por_confirmar` y sin correo ni teléfono |
| `?pestana=proximas` / `por_confirmar` / `completadas` / `canceladas` / `todas` | cada una con su orden (próximas y por confirmar: la más antigua primero; el resto, la más reciente primero) |
| `?q=ana` (cliente o servicio), `?q=%25` | filtra; `%`, `_` y `\` se toman como texto, no como comodines |
| `?desde=2026-10-01&hasta=2026-10-03` | rango inclusivo; `desde` posterior a `hasta` o una fecha como `2026-02-31` → `400` `PARAMETRO_INVALIDO` |
| `?pagina=99` | `200` con `items: []` y el `total` real |
| `?barbero_id=2`, `?x=1`, `?pestana=hoy&pestana=todas`, `?pestana=otra`, `?limite=51` | `400` `PARAMETRO_INVALIDO` (el barbero nunca se elige desde el cliente) |
| Sin token / con el token del admin | `401` / `403` |
| Con la contraseña caducada / usuario desactivado | `403` `CONTRASENA_CADUCADA` / `401` `SESION_INVALIDA` |

### AG. Pantalla `/panel/citas`

1. **Pestañas con conteo:** Hoy, Próximas, Por confirmar, Completadas, Canceladas y Todas. La activa va resaltada; **Por confirmar** lleva una insignia naranja cuando su conteo es mayor que 0. Se recorren con Tab y se activan con Enter o Espacio.
2. **URL:** al cambiar de pestaña, buscar, elegir fechas o paginar, la URL cambia (`?pestana=&q=&desde=&hasta=&pagina=`); copiar el enlace o recargar (F5) deja la misma vista. Un valor inválido en la URL se ignora; una página inexistente pasa a la última. Cualquier filtro vuelve a la página 1; "Limpiar filtros" los quita. No hay filtro de barbero.
3. **Escritorio (≥ 1280 px):** tabla con Fecha, Hora, Cliente, Servicio, Duración, Precio, Estado y acciones. **Menos de 1280 px:** tarjetas con la misma información. La insignia **Por confirmar** sale en las pendientes que ya terminaron hace más de 2 h; un precio 0 se ve "Gratis".
4. **Acciones (solo pendientes):** **Completar** es directo; **Cancelar** abre un diálogo propio de confirmación (no el del navegador). Completar una cita futura muestra el mensaje del back-end. Tras cualquiera, la lista se recarga en la misma página y con los mismos filtros, y el aviso fijo "No has confirmado N citas" se actualiza al instante (y desaparece al llegar a 0).
5. **Estados:** esqueletos al cargar; "No pudimos cargar tus citas." con **Reintentar** (apaga el back-end para verlo); mensaje vacío distinto por pestaña ("Hoy no tienes citas agendadas.", "No tienes citas por confirmar. Todo está al día.", …) y, con filtros activos, "No hay citas que coincidan con los filtros." con **Limpiar filtros**.
6. **Paginación:** 15 por página con "Mostrando 1–15 de N"; en móvil, "Anterior · Página 2 de 3 · Siguiente".
7. **`/admin/citas`** se ve y funciona igual que antes (pestañas sin conteo, filtro de barbero, reasignar).
8. **Responsive (API real):** a 360, 375, 414, 768, 1024 y 1440 px no hay scroll horizontal en ninguna pestaña, en el estado vacío, con filtros activos ni con paginación; los controles miden al menos 44 px.

---

## Dashboard del barbero, fase 5 — Mi rendimiento (`/panel/rendimiento`) y Mi cuenta (`/panel/cuenta`)

> **Estado de la base de desarrollo:** al cerrar el dashboard se borraron las citas demo y se desactivaron los barberos `prueba_f3a`, `prueba_f3b` y `prueba_f3c`. Las cifras de ejemplo de esta sección (totales, páginas, ingresos) salen de una base con citas demo generadas: los totales que devuelva `curl` dependen de las citas que haya. Con la base limpia, un barbero sin citas debe ver ceros ($0) y los mensajes de vacío; es parte de la prueba.

No cambia el esquema. Necesitas citas completadas del barbero (ver la fase 3: `seed:demo`).

### AH. Endpoints de estadísticas (curl)

```bash
API=http://localhost:5001/api
BARBERO=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"usuario":"prueba_f3a","contrasena":"..."}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s "$API/barbero/estadisticas?periodo=30d" -H "Authorization: Bearer $BARBERO"
curl -s "$API/barbero/estadisticas/ingresos?agrupar=dia" -H "Authorization: Bearer $BARBERO"
curl -s "$API/barbero/estadisticas/servicios-top?periodo=mes&limite=5" -H "Authorization: Bearer $BARBERO"
```

| Qué haces | Qué debe pasar |
|---|---|
| `GET $API/barbero/estadisticas` (sin parámetros) | `200`: período `hoy`, `{ periodo, anterior, actual, previo }` con `citas`, `completadas`, `canceladas`, `ingresos` y `ticket_promedio`, solo del barbero del token |
| `?periodo=7d` / `30d` / `mes` | el período y el anterior con la misma cantidad de días (`mes`: del 1 al día de hoy contra el mismo tramo del mes anterior) |
| `/estadisticas/ingresos` y `?agrupar=mes` | 30 días (12 meses) y los 30 (12) anteriores, con ceros incluidos |
| `/estadisticas/servicios-top?limite=3` | sus servicios más pedidos (solo completadas), con `cantidad` e `ingresos` (el precio de la cita) |
| Ingresos | suma el precio guardado en la cita; las canceladas no suman y el ticket promedio excluye las de precio 0 |
| `?barbero_id=2`, `?x=1`, `?periodo=7d&periodo=30d`, `?periodo=ayer`, `?agrupar=semana`, `?limite=21` | `400` `PARAMETRO_INVALIDO` (el barbero nunca se elige desde el cliente) |
| Sin token / con el token del admin | `401` / `403` |
| Con la contraseña caducada / usuario desactivado | `403` `CONTRASENA_CADUCADA` / `401` `SESION_INVALIDA` |
| `POST`, `PATCH`, `DELETE` a estas rutas | `404` |
| `GET /api/admin/estadisticas` con el token del admin | sigue sumando a todos los barberos y sus 400 no llevan `codigo` |

Para ver el estado "por vencer" sin esperar 58 días: `UPDATE usuarios SET contrasena_cambiada_en = now() - interval '58 days' WHERE usuario = 'prueba_f3c';` (y devuélvelo a `now()` al terminar).

### AI. Pantalla `/panel/rendimiento`

1. El menú lateral tiene cuatro entradas: **Resumen**, **Mis citas**, **Mi rendimiento** y **Mi cuenta**; la actual va marcada.
2. Elige **Hoy**, **7 días**, **30 días** y **Mes**: las cuatro tarjetas (**Cortes**, **Ingresos**, **Ticket promedio**, **Canceladas**) y los **Servicios más pedidos** cambian; cada tarjeta se compara con el período anterior (flecha y porcentaje; "—" si el anterior no tiene datos).
3. El gráfico de **Ingresos** (por día o por mes) es solo con tus citas; con el lector de pantalla se anuncia como imagen y tiene su tabla de datos.
4. Entra con un barbero sin citas completadas (`prueba_f3b`): ceros ($0, 0), "No tienes cortes completados en este período.", "Todavía no hay ingresos en este rango." y "Aún no hay servicios completados en este período." Nunca "NaN" ni "Gratis".
5. Apaga el back-end y recarga: cada panel muestra su error con **Reintentar**.
6. Con citas por confirmar, el aviso fijo sigue abajo; con la contraseña por vencer, el aviso de caducidad sigue arriba.

### AJ. Pantalla `/panel/cuenta`

1. Muestra el avatar (iniciales si no hay foto), nombre, cargo, especialidad y usuario, sin campos editables.
2. **Contraseña vigente:** "Tu contraseña está vigente. Vence el <fecha>; faltan N días." y "Solo el administrador puede restablecer tu contraseña antes de que venza". No hay formulario ni botón de cambiar contraseña.
3. **Por vencer** (2 días o menos): aviso ámbar con **Cambiar contraseña**; al abrirlo aparece UN solo formulario (el del layout no se repite en esta ruta). Cámbiala: "Contraseña actualizada. La nueva vale 60 días." y la página pasa a "vigente".
4. **Caducada:** aparece la pantalla obligatoria "Tu contraseña caducó" en lugar del panel.
5. **Cerrar sesión** (botón de la página) cierra la sesión y lleva a `/acceso`.
6. Una ruta desconocida como `/panel/cuenta/otra` vuelve a `/panel`; sin sesión, `/panel/cuenta` lleva a `/acceso`, y el admin no entra.
7. **Responsive (API real):** a 360, 375, 414, 768, 1024 y 1440 px no hay scroll horizontal en ninguno de los cuatro períodos (con datos y con un barbero vacío), ni en Mi cuenta (vigente, por vencer y con el formulario abierto); los controles miden al menos 44 px.

---

## Login (`/acceso`)

Requisitos: backend y front arriba. Marca cada caso en 360, 375, 414, 768, 1024 y 1440 px.

1. **Diseño:** a ≥ 1024 px hay panel de marca a la izquierda (logo, frase y 3 puntos) y la tarjeta a la derecha; por debajo, una sola columna con la insignia dorada dentro de la tarjeta. No hay menú público, franja de garantía, footer ni botón de WhatsApp. Sin scroll horizontal.
2. **Foco y teclado:** al abrir, el cursor está en Usuario. Tab recorre Usuario → Contraseña → ojo → Ingresar, con contorno dorado visible. El ojo muestra y oculta la contraseña.
3. **Texto de ayuda:** "¿Olvidaste tu contraseña? Pídele al administrador que la restablezca" no es un enlace. No hay "Registrarse" ni "Recordarme". "← Volver al sitio" lleva a `/`.
4. **Bloq Mayús:** con Bloq Mayús activo, al escribir en Contraseña aparece "Bloq Mayús está activado"; se va al desactivarlo o al salir del campo.
5. **Credenciales:** usuario inexistente, usuario desactivado y contraseña incorrecta dan el mismo mensaje: "Usuario o contraseña incorrectos". Campos vacíos: "Usuario y contraseña son obligatorios" (sin petición).
6. **Carga:** al enviar, el botón dice "Ingresando..." y está deshabilitado; pulsar Enter varias veces seguidas envía una sola petición (pestaña Red).
7. **Servidor caído:** detén el backend e intenta entrar: "No pudimos conectar con el servidor...". Con el back-end devolviendo 5xx: "El servidor no está disponible por ahora...".
8. **Límite de intentos:** con 10 intentos fallidos seguidos, el undécimo muestra "Demasiados intentos. Vuelve a intentarlo en 15 minutos." y el botón queda en "Espera 14:59" y deshabilitado; la cuenta atrás baja y, al llegar a 0, se habilita. En la pestaña Red, la respuesta 429 trae `reintentar_en_seg` en el cuerpo. (Para repetirlo sin esperar, reinicia el backend: el contador vive en memoria.)
9. **Sesión expirada:** inicia sesión, abre DevTools → Application → Local Storage y cambia el `token` por texto basura o desactiva al usuario desde el admin y recarga una página del panel. Esperado: vuelves a `/acceso` con "Tu sesión expiró. Vuelve a iniciar sesión". Si en cambio pulsas "Cerrar sesión", ese aviso NO aparece.
10. **Redirecciones:** admin → `/admin`; barbero → `/panel`; barbero con la contraseña caducada → pantalla "Tu contraseña caducó"; con sesión activa, abrir `/acceso` te lleva a tu panel.
11. **Móvil con teclado:** en DevTools reduce la altura a ~320 px (teclado abierto): el formulario sigue accesible haciendo scroll y no hay scroll horizontal. Con "Reducir movimiento" activado no hay animaciones de entrada.
