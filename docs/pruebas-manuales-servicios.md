# Pruebas manuales — catálogo de servicios (back-end)

Comandos reales contra el backend levantado con `docker compose up` (API en `http://localhost:5001/api`) y la base sembrada con `npm run seed` (39 servicios activos en 6 categorías; los 6 servicios del catálogo anterior, ids 1–6, quedan inactivos).

```bash
API="http://localhost:5001/api"
```

> **Si cambias el código del back-end, reconstruye la imagen** (`docker compose up --build -d backend`) y corre el seed dentro del contenedor (`docker compose exec backend npm run seed`). Un contenedor viejo en el puerto 5001 sirve el listado anterior (sin descripción, con los 6 servicios inactivos) y estos casos fallarían.
>
> Los ids de los servicios nuevos los asigna la secuencia de la base. En la base de desarrollo actual `Corte militar` es el **34** y `Corte clásico` el **35**. Si en tu base son otros, consúltalos con el caso 1 y sustituye el número en los casos que lo usan. Los ids **1 a 6** son los servicios viejos (inactivos).

Los casos con `?q=` o caracteres especiales usan `--get --data-urlencode` para que `curl` codifique bien el valor.

---

## A. Listado: GET /servicios

### 1. Listado completo (solo activos, orden por defecto)

```bash
curl "$API/servicios"
```

Esperado: `200`, arreglo de **39** elementos, ordenado por categoría (Cortes, Barba, Keratinas, Faciales, Cortes + barba, Ondulados), luego precio ascendente y nombre. Cada elemento:

```json
{"id":34,"nombre":"Corte militar","descripcion":"Corte corto, práctico y uniforme, ideal para un estilo sencillo y masculino.","precio":18000,"duracion_min":25,"tipo":"original","categoria":{"id":1,"nombre":"Cortes","slug":"cortes"}}
```

No aparece ningún servicio con id 1 a 6.

### 2. Filtrar por categoría

```bash
curl "$API/servicios?categoria=barba"
```

Esperado: `200`, 6 servicios, todos con `"categoria":{"id":2,"nombre":"Barba","slug":"barba"}`.

### 3. Filtrar por tipo

```bash
curl "$API/servicios?tipo=vip"
```

Esperado: `200`, solo servicios con `"tipo":"vip"`. Valores admitidos: `original`, `elite`, `vip`.

### 4. Búsqueda por nombre (sin distinguir mayúsculas)

```bash
curl --get "$API/servicios" --data-urlencode "q=BARBA"
```

Esperado: `200`, 11 servicios cuyo nombre contiene "barba" (por ejemplo `Perfilado de barba`, `Diseño de barba`, `Corte ejecutivo + barba`).

### 5. `%` y `_` se buscan literalmente

```bash
curl --get "$API/servicios" --data-urlencode "q=%"
```

Esperado: `200` y `[]` (ningún nombre del catálogo real contiene el símbolo `%`; si `%` fuera comodín devolvería los 39).

```bash
curl --get "$API/servicios" --data-urlencode "q=_"
```

Esperado: `200` y `[]` (ningún nombre contiene un guion bajo; como comodín devolvería los 39).

### 6. Filtros combinados

```bash
curl "$API/servicios?categoria=cortes&tipo=elite&ordenar=precio&direccion=desc"
```

Esperado: `200`, los servicios élite de Cortes, del más caro al más barato (`Corte ejecutivo` 30000, `Corte mullet` 28000, `Corte degradado (Fade)` 25000).

### 7. Ordenar

```bash
curl "$API/servicios?ordenar=precio&direccion=desc"
```

Esperado: `200`, de mayor a menor precio en todo el listado (el primero es `Alisado premium y reconstrucción capilar`, 160000). Los empates se resuelven por nombre ascendente.

```bash
curl "$API/servicios?ordenar=duracion"
```

Esperado: `200`, de menor a mayor duración (`direccion` por defecto: `asc`).

```bash
curl "$API/servicios?ordenar=nombre&direccion=desc"
```

Esperado: `200`, de la Z a la A.

### 8. Agrupar por categoría

```bash
curl "$API/servicios?agrupar=categoria"
```

Esperado: `200`, arreglo de 6 grupos en el orden de las categorías:

```json
[{"categoria":{"id":1,"nombre":"Cortes","slug":"cortes","orden":1},"servicios":[{"id":34,"nombre":"Corte militar","descripcion":"…","precio":18000,"duracion_min":25,"tipo":"original","categoria":{"id":1,"nombre":"Cortes","slug":"cortes"}}]}]
```

(el ejemplo muestra un solo servicio; cada grupo trae todos los suyos).

```bash
curl "$API/servicios?agrupar=categoria&tipo=vip&ordenar=duracion&direccion=desc"
```

Esperado: `200`, los grupos que tengan servicios VIP (una categoría sin ninguno **no aparece**), y dentro de cada grupo de mayor a menor duración.

### 9. Categoría válida sin resultados tras filtrar

```bash
curl "$API/servicios?categoria=barba&q=ondulado"
```

Esperado: `200` y `[]`.

---

## B. Parámetros inválidos → 400

Todas devuelven `{"error":"…"}` con el mensaje indicado.

```bash
curl -i "$API/servicios?tipo=oro"
```

Esperado: `400`, `{"error":"El parámetro 'tipo' debe ser uno de: original, elite, vip"}`.

```bash
curl -i "$API/servicios?ordenar=color"
```

Esperado: `400`, `{"error":"El parámetro 'ordenar' debe ser uno de: precio, duracion, nombre"}`.

```bash
curl -i "$API/servicios?ordenar=precio&direccion=arriba"
```

Esperado: `400`, `{"error":"El parámetro 'direccion' debe ser asc o desc"}`.

```bash
curl -i "$API/servicios?direccion=desc"
```

Esperado: `400`, `{"error":"El parámetro 'direccion' requiere indicar también 'ordenar'"}`.

```bash
curl -i "$API/servicios?agrupar=tipo"
```

Esperado: `400`, `{"error":"El parámetro 'agrupar' solo admite el valor categoria"}`.

```bash
curl -i "$API/servicios?categoria=no-existe"
```

Esperado: `400`, `{"error":"La categoría 'no-existe' no existe"}`.

```bash
curl -i "$API/servicios?categoria=Cortes%20y%20mas"
```

Esperado: `400`, `{"error":"El parámetro 'categoria' debe ser un slug válido (por ejemplo: cortes)"}`.

```bash
curl -i --get "$API/servicios" --data-urlencode "q=$(printf 'a%.0s' $(seq 1 101))"
```

Esperado: `400`, `{"error":"El parámetro 'q' no puede superar 100 caracteres"}`.

```bash
curl -i "$API/servicios?tipo=vip&tipo=elite"
```

Esperado: `400`, `{"error":"El parámetro 'tipo' debe enviarse una sola vez y como texto"}`.

```bash
curl -i -g "$API/servicios?tipo[]=vip"
```

Esperado: `400`, `{"error":"Parámetro desconocido 'tipo[]'. Parámetros admitidos: categoria, tipo, q, ordenar, direccion, agrupar"}`.

```bash
curl -i "$API/servicios?categorai=cortes"
```

Esperado: `400` (un error de tipeo no se ignora en silencio): `{"error":"Parámetro desconocido 'categorai'. Parámetros admitidos: …"}`.

---

## C. Detalle: GET /servicios/:id

### 1. Servicio activo

```bash
curl "$API/servicios/34"
```

Esperado: `200`:

```json
{"id":34,"nombre":"Corte militar","descripcion":"Corte corto, práctico y uniforme, ideal para un estilo sencillo y masculino.","precio":18000,"duracion_min":25,"tipo":"original","categoria":{"id":1,"nombre":"Cortes","slug":"cortes"}}
```

### 2. Servicio inactivo (catálogo anterior)

```bash
curl -i "$API/servicios/1"
```

Esperado: `404`, `{"error":"Servicio no encontrado"}`.

### 3. Servicio inexistente

```bash
curl -i "$API/servicios/99999"
```

Esperado: `404`, `{"error":"Servicio no encontrado"}`.

```bash
curl -i "$API/servicios/99999999999999"
```

Esperado: `404` (un id mayor que un entero de Postgres no provoca un error 500).

### 4. Id no numérico

```bash
curl -i "$API/servicios/abc"
```

Esperado: `400`, `{"error":"El id del servicio debe ser numérico"}`. Lo mismo con `1.5`, `-1` o `1e3`.

---

## D. Categorías: GET /categorias

```bash
curl "$API/categorias"
```

Esperado: `200`, en orden:

```json
[{"id":1,"nombre":"Cortes","slug":"cortes","orden":1,"total_servicios":8},
 {"id":2,"nombre":"Barba","slug":"barba","orden":2,"total_servicios":6},
 {"id":3,"nombre":"Keratinas","slug":"keratinas","orden":3,"total_servicios":6},
 {"id":4,"nombre":"Faciales","slug":"faciales","orden":4,"total_servicios":6},
 {"id":5,"nombre":"Cortes + barba","slug":"cortes-barba","orden":5,"total_servicios":7},
 {"id":6,"nombre":"Ondulados","slug":"ondulados","orden":6,"total_servicios":6}]
```

(la suma es 39). `total_servicios` cuenta solo servicios activos: si desactivas uno en la base (`UPDATE servicios SET activo = false WHERE id = 34;`) el total de Cortes baja a 7 y el servicio deja de salir en `/servicios`. Para revertirlo: `UPDATE servicios SET activo = true WHERE id = 34;`.

---

## E. Reservas y disponibilidad con servicios inactivos

### 1. Disponibilidad con servicio inactivo

```bash
curl -i "$API/disponibilidad?servicio=1&barbero=1&fecha=2030-06-15"
```

Esperado: `400`, `{"error":"El servicio seleccionado no existe o no está disponible","codigo":"SERVICIO_NO_DISPONIBLE"}` (el front usa ese `codigo` para volver al paso Servicio).

### 2. Disponibilidad con servicio inexistente (sin cambios)

```bash
curl -i "$API/disponibilidad?servicio=99999&barbero=1&fecha=2030-06-15"
```

Esperado: `404`, `{"error":"Servicio no encontrado"}`.

### 3. Disponibilidad con servicio activo

```bash
curl "$API/disponibilidad?servicio=34&barbero=1&fecha=2030-06-15"
```

Esperado: `200`, `{"barbero_id":1,"fecha":"2030-06-15","horas":["09:00","09:30",…]}` (horas libres donde cabe el servicio de 25 min).

### 4. Reservar un servicio inactivo

```bash
curl -i -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente Prueba","correo":"cliente@example.com","telefono":"3001112222","consentimiento":true,"servicio_id":1,"barbero_id":1,"fecha":"2030-06-15","hora":"10:00"}'
```

Esperado: `400`, `{"error":"El servicio seleccionado no existe o no está disponible","codigo":"SERVICIO_NO_DISPONIBLE"}` (el front usa ese `codigo` para volver al paso Servicio). No se crea ninguna cita.

### 5. Reservar un servicio activo

```bash
curl -i -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente Prueba","correo":"cliente@example.com","telefono":"3001112222","consentimiento":true,"servicio_id":34,"barbero_id":1,"fecha":"2030-06-15","hora":"10:00"}'
```

Esperado: `201`, con `servicio_id` 34, `duracion_min` 25, `precio` 18000 y `servicio_nombre` "Corte militar". (Esto crea una cita real en la base de desarrollo: cancélala desde el panel o con `PATCH /citas/:id` si no la quieres.)

---

## Lo que NO queda cubierto por pruebas automáticas

- **Contra el catálogo real de desarrollo.** Las pruebas Supertest crean sus propios servicios y categorías en la base de pruebas; el contenido real (39 servicios, textos y precios) solo se verifica con el seed (`catalogo.test.js`) y con estos curls.
- **Rendimiento.** No hay medición de tiempos ni de carga; el listado hace una sola consulta sin paginación (son 39 filas).
- **Intercalación (orden alfabético con tildes y mayúsculas).** `ordenar=nombre` usa el orden de la base de datos; las pruebas usan nombres con iniciales distintas y sin tildes iniciales, por lo que no cubren diferencias de intercalación entre servidores.
- **Reglas de reserva más allá de lo indicado** (solapamientos, cierre, asignación): las cubren las pruebas existentes de citas, disponibilidad y concurrencia, no estas.
- **Codificación de URL en clientes reales.** Las pruebas envían los parámetros ya codificados por Supertest; el comportamiento con otras librerías HTTP (por ejemplo `+` como espacio) no se prueba.
- **Servicios sin categoría activos.** El código los admite (categoría `null`, al final), pero ningún dato real ni prueba lo ejercita: el seed deja todo categorizado.
- **El front-end** (todavía no consume estos endpoints; es el bloque 3).
- **Arranque con la migración sobre la base de desarrollo real**: se probó una vez a mano en el bloque 1, no en cada arranque.
