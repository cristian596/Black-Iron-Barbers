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

// { servicio_nombre, servicios } de una cita concreta.
export const serviciosDeCita = async (db, citaId) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_SERVICIOS} FROM citas c ${unirServiciosDeCita()} WHERE c.id = $1`,
    [citaId]
  );
  return rows[0] ?? { servicio_nombre: null, servicios: [] };
};
