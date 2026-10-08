// Fragmentos SQL comunes para leer los servicios de una cita (tabla cita_servicios). El nombre y los datos salen del
// snapshot guardado al reservar, no del catálogo. Una sola definición para que todas las respuestas coincidan.

// Une a la cita (alias `c` por defecto) sus servicios agregados, siempre una fila por cita:
//  sv.nombre = nombres unidos con " + " (orden de la reserva) · sv.servicios = [{ id, nombre, duracion_min, precio }].
export const unirServiciosDeCita = (cita = 'c') => `
  CROSS JOIN LATERAL (
    SELECT string_agg(cs.nombre, ' + ' ORDER BY cs.orden) AS nombre,
           COALESCE(
             json_agg(
               json_build_object('id', cs.servicio_id, 'nombre', cs.nombre, 'duracion_min', cs.duracion_min, 'precio', cs.precio)
               ORDER BY cs.orden
             ),
             '[]'::json
           ) AS servicios
    FROM cita_servicios cs
    WHERE cs.cita_id = ${cita}.id
  ) sv`;

export const COLUMNAS_SERVICIOS = 'sv.nombre AS servicio_nombre, sv.servicios';

// Condición: algún servicio de la cita coincide con el patrón (ya escapado; ver escaparLike) por su nombre.
export const algunServicioCoincide = (parametro, cita = 'c') =>
  `EXISTS (SELECT 1 FROM cita_servicios cs WHERE cs.cita_id = ${cita}.id AND cs.nombre ILIKE ${parametro} ESCAPE '\\')`;

// Área de la cita ('barberia' | 'asesoria'): la de su servicio principal (citas.servicio_id). Coincide con la de su
// profesional (lo garantizan los triggers del esquema); en las citas anteriores a las asesorías manda el servicio.
export const areaDeCita = (cita = 'c') => `(SELECT sp.area FROM servicios sp WHERE sp.id = ${cita}.servicio_id)`;

// Columnas de reserva de cada cita en los listados: `area`, `reserva_id` (nulo = cita suelta) y `hermana`: si la cita
// es parte de una reserva combinada (asesoría + corte), la OTRA cita con SOLO estos campos mínimos
// { id, area, profesional (nombre público), hora_inicio, hora_fin, estado } (horas 'HH:MM:SS'); si no, null. Nada de
// contacto, precios ni servicios de la hermana: es la misma persona, pero la hermana es de otro profesional.
export const COLUMNAS_RESERVA = `
  ${areaDeCita()} AS area, c.reserva_id,
  (SELECT json_build_object(
            'id', h.id, 'area', ${areaDeCita('h')}, 'profesional', hb.nombre,
            'hora_inicio', h.hora::text, 'hora_fin', (h.hora + make_interval(mins => h.duracion_min))::text,
            'estado', h.estado)
   FROM citas h JOIN barberos hb ON hb.id = h.barbero_id
   WHERE c.reserva_id IS NOT NULL AND h.reserva_id = c.reserva_id AND h.id <> c.id
   ORDER BY h.hora, h.id LIMIT 1) AS hermana`;

// { servicio_nombre, servicios } de una cita concreta.
export const serviciosDeCita = async (db, citaId) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_SERVICIOS} FROM citas c ${unirServiciosDeCita()} WHERE c.id = $1`,
    [citaId]
  );
  return rows[0] ?? { servicio_nombre: null, servicios: [] };
};
