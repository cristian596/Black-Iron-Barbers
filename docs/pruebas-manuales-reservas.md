# Pruebas manuales — reservas (back-end)

Comandos reales contra el backend levantado con `docker compose up` (API en `http://localhost:5001/api`). Reemplaza `$ADMIN` por un token obtenido en `POST /auth/login` cuando el comando lo requiera.

```bash
API="http://localhost:5001/api"

# Id de un servicio ACTIVO por su nombre exacto (los ids los asigna la base; no se escriben a mano).
# La URL se codifica con Node porque el curl de Windows envía las tildes en latin-1 y el servidor no las reconoce.
id_servicio() {
  node -e "fetch(process.argv[1]+'/servicios?q='+encodeURIComponent(process.argv[2])).then(r=>r.json()).then(l=>{const s=l.find(x=>x.nombre===process.argv[2]);if(!s){console.error('Servicio no encontrado: '+process.argv[2]);process.exit(1)}console.log(s.id)})" "$API" "$1"
}

CORTE=$(id_servicio "Corte clásico")              # 30 min
SERVICIO_90=$(id_servicio "Keratina cabello corto")   # 90 min
echo "CORTE=$CORTE SERVICIO_90=$SERVICIO_90"      # deben ser números; si salen vacíos, el seed no se ha corrido
```

> Las duraciones de arriba son las del catálogo actual. Los casos 3 y 4 dependen de que `SERVICIO_90` dure 90 min y `CORTE` 30 min; si cambias esos servicios, elige otros con `GET /api/servicios?ordenar=duracion`.

## 1. Cualquier barbero, asignación por menos citas

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente Prueba","correo":"cliente@example.com","telefono":"3001112222","consentimiento":true,"servicio_id":'$CORTE',"fecha":"2026-12-01","hora":"09:00"}'
```

Resultado esperado: `201`, `barbero_id` es el barbero activo con menos citas ese día (empate por id ascendente).

## 2. Doble reserva exacta

Repetir exactamente la misma petición del punto 1 (mismo `servicio_id`, `fecha`, `hora`, y fijando el mismo `barbero_id` que devolvió):

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente Prueba","correo":"cliente@example.com","telefono":"3001112222","consentimiento":true,"servicio_id":'$CORTE',"barbero_id":1,"fecha":"2026-12-01","hora":"09:00"}'
```

Resultado esperado: `409`, `{"error":"Ese horario ya está reservado para este barbero, elige otro"}`.

## 3. Solapamiento por duración (90 min a las 10:00, otra a las 10:30)

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente A","correo":"a@example.com","telefono":"3001112222","consentimiento":true,"servicio_id":'$SERVICIO_90',"barbero_id":1,"fecha":"2026-12-02","hora":"10:00"}'
```

Resultado esperado: `201` (servicio de 90 min, 10:00–11:30).

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente B","correo":"b@example.com","telefono":"3002223333","consentimiento":true,"servicio_id":'$CORTE',"barbero_id":1,"fecha":"2026-12-02","hora":"10:30"}'
```

Resultado esperado: `409` (se solapa con la cita anterior, aunque la hora exacta sea distinta).

## 4. Servicio que no cabe antes del cierre

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente Tarde","correo":"tarde@example.com","telefono":"3003334444","consentimiento":true,"servicio_id":'$SERVICIO_90',"barbero_id":1,"fecha":"2026-12-03","hora":"18:30"}'
```

Resultado esperado: `400`, `{"error":"El servicio no cabe dentro del horario de atención a esa hora"}`.

## 5. Reasignación a barbero ocupado y a barbero libre

Primero inicia sesión como admin y guarda el token:

```bash
curl -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"usuario":"TU_USUARIO_ADMIN","contrasena":"TU_CONTRASENA_ADMIN"}'
```

Con el `token` de la respuesta (`$ADMIN`), reasigna una cita existente (`ID_CITA`) a un barbero que ya tiene choque de horario:

```bash
curl -X PATCH "$API/citas/ID_CITA" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN" \
  -d '{"barbero_id":2}'
```

Resultado esperado si el barbero 2 tiene una cita que se cruza: `409`. Si está libre: `200` con `barbero_id` actualizado.

## 6. Cancelar libera el hueco

```bash
curl -X PATCH "$API/citas/ID_CITA" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN" \
  -d '{"estado":"cancelada"}'
```

Resultado esperado: `200`, `estado: "cancelada"`. Luego, reservar en el mismo barbero/fecha/hora:

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Cliente Nuevo","correo":"nuevo@example.com","telefono":"3004445555","consentimiento":true,"servicio_id":'$CORTE',"barbero_id":1,"fecha":"2026-12-02","hora":"10:00"}'
```

Resultado esperado: `201` (el hueco quedó libre).

## 7. Teléfono inválido y normalización

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Tel Invalido","correo":"telinvalido@example.com","telefono":"12345","consentimiento":true,"servicio_id":'$CORTE',"barbero_id":5,"fecha":"2026-12-04","hora":"10:00"}'
```

Resultado esperado: `400`, `{"error":"El teléfono debe ser un celular colombiano válido (10 dígitos, inicia en 3)"}`.

```bash
curl -X POST "$API/citas" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Tel Con Prefijo","correo":"telprefijo@example.com","telefono":"+57 300 999 8888","consentimiento":true,"servicio_id":'$CORTE',"barbero_id":5,"fecha":"2026-12-04","hora":"11:00"}'
```

Resultado esperado: `201`, el campo `telefono` de la respuesta es `"3009998888"`.

## 8. Hora pasada de hoy

Obtén primero la fecha real de hoy en Bogotá (no la fecha UTC del sistema):

```bash
HOY=$(node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date()))")
curl "$API/disponibilidad?servicio=$CORTE&barbero=1&fecha=$HOY"
```

Resultado esperado: las horas anteriores a la hora actual de Bogotá no aparecen en el arreglo `horas`.

## 9. Aislamiento entre barberos

Inicia sesión como un barbero y guarda su token (`$BARBERO_A`):

```bash
curl -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"usuario":"USUARIO_BARBERO_A","contrasena":"CONTRASENA_BARBERO_A"}'
```

```bash
curl "$API/citas" \
  -H "Authorization: Bearer $BARBERO_A"
```

Resultado esperado: solo aparecen las citas cuyo `barbero_id` corresponde a ese barbero.

```bash
curl -X PATCH "$API/citas/ID_CITA_DE_OTRO_BARBERO" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BARBERO_A" \
  -d '{"estado":"completada"}'
```

Resultado esperado: `404`, `{"error":"Cita no encontrada"}` (no revela que la cita existe, solo que no es suya).

## 10. Rate limiting

En producción, `POST /api/citas` está limitado a 20 solicitudes cada 15 minutos por IP. Para comprobarlo hay que superar ese umbral con solicitudes reales (horas distintas para que lo que limite sea el rate limit y no un 409 de negocio); al superarlo, la respuesta es `429` con `{"error":"Demasiadas solicitudes de reserva, intenta más tarde"}`. En la suite automatizada (`backend/tests/rateLimit.test.js`) esto se prueba con un límite bajo forzado solo para esa prueba, sin esperar 15 minutos reales.
