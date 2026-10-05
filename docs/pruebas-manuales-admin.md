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
- **Citas** y **Empleados:** conservan el comportamiento del panel anterior (resumen por estado/barbero, filtros, completar, cancelar y reasignar; crear usuario de barbero, resetear contraseña, activar y desactivar). Verifica que sigan funcionando igual.

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
| Completar cita futura | `curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"estado":"completada"}' $API/citas/<id de una cita futura>` | `400` `{"error":"No se puede completar una cita de una fecha futura","codigo":"CITA_FUTURA"}`; la cita no cambia. Igual con el token de su barbero |
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
11. **Acciones:** estando en la página 3 con un filtro, pulsa **Completar** (en una cita de hoy o pasada), **Cancelar** (pide confirmación) o cambia el barbero: la lista se recarga y sigues en la página 3 con el mismo filtro. En una cita futura, **Completar** muestra el mensaje "No se puede completar una cita de una fecha futura" y no cambia nada. Si cancelas la única cita de la última página, pasas a la anterior.
12. **Móvil (360–414 px):** las citas son tarjetas (con las acciones, incluido reasignar) y no hay scroll horizontal.

### M. Contraseña propia del admin

En el menú de usuario → **Cambiar contraseña**, el botón "Guardar contraseña" es dorado (token `oro`). En el panel del barbero (`/panel`) el botón sigue crema, como antes.

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
