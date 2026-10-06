// Consultas de las estadísticas del admin. Reciben el ejecutor `db` (pool o cliente) para poder probarlas
// con distintas zonas horarias de sesión.
//
// Reglas comunes:
//  - citas.fecha es DATE en hora local de Bogotá: no se convierte nada. "Hoy" lo decide Node y llega como
//    parámetro; nunca CURRENT_DATE ni NOW(), que dependen de la zona del servidor Postgres.
//  - Ingresos = SUM(citas.precio) de las completadas (precio guardado en la cita, no el del catálogo). Es la suma de
//    los servicios de la cita; las cifras por cita (cortes, ingresos, ticket promedio) cuentan CITAS, no servicios.
//  - serviciosTop cuenta servicios: una cita con 3 servicios suma 1 a cada uno (cantidad = líneas de cita_servicios,
//    ingresos = SUM del precio de la línea), no atribuye la cita entera a un solo servicio.
//  - Las fechas se devuelven como texto AAAA-MM-DD (pg convertiría un DATE a Date según la zona del proceso).
//  - Las series usan generate_series(0, n) sumado a una fecha: así no dependen de la zona de la sesión.

const COMPLETADA = "c.estado = 'completada'";

// `barberoId` (opcional, en todas las consultas) limita las cifras a las citas de ese barbero; sin él son las de todos (estadísticas del admin).
export const resumenPeriodo = async (db, { desde, hasta }, barberoId = null) => {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE c.estado <> 'cancelada')::int AS citas,
       COUNT(*) FILTER (WHERE ${COMPLETADA})::int AS completadas,
       COUNT(*) FILTER (WHERE c.estado = 'cancelada')::int AS canceladas,
       COALESCE(SUM(c.precio) FILTER (WHERE ${COMPLETADA}), 0)::int AS ingresos,
       COALESCE(ROUND(AVG(c.precio) FILTER (WHERE ${COMPLETADA} AND c.precio > 0)), 0)::int AS ticket_promedio
     FROM citas c
     WHERE c.fecha BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR c.barbero_id = $3::int)`,
    [desde, hasta, barberoId]
  );
  return rows[0];
};

export const ingresosPorDia = async (db, desde, dias, barberoId = null) => {
  const { rows } = await db.query(
    `SELECT to_char($1::date + n, 'YYYY-MM-DD') AS fecha,
            COALESCE(SUM(c.precio) FILTER (WHERE ${COMPLETADA}), 0)::int AS ingresos,
            COUNT(c.id) FILTER (WHERE ${COMPLETADA})::int AS cortes
     FROM generate_series(0, $2::int - 1) AS n
     LEFT JOIN citas c ON c.fecha = $1::date + n AND ($3::int IS NULL OR c.barbero_id = $3::int)
     GROUP BY n
     ORDER BY n`,
    [desde, dias, barberoId]
  );
  return rows;
};

// `primerMes` es el día 1 del primer mes de la serie.
export const ingresosPorMes = async (db, primerMes, meses, barberoId = null) => {
  const { rows } = await db.query(
    `SELECT to_char(m.inicio, 'YYYY-MM') AS mes,
            COALESCE(SUM(c.precio) FILTER (WHERE ${COMPLETADA}), 0)::int AS ingresos,
            COUNT(c.id) FILTER (WHERE ${COMPLETADA})::int AS cortes
     FROM (
       SELECT ($1::date + make_interval(months => n))::date AS inicio
       FROM generate_series(0, $2::int - 1) AS n
     ) m
     LEFT JOIN citas c
       ON c.fecha >= m.inicio AND c.fecha < (m.inicio + interval '1 month')::date
      AND ($3::int IS NULL OR c.barbero_id = $3::int)
     GROUP BY m.inicio
     ORDER BY m.inicio`,
    [primerMes, meses, barberoId]
  );
  return rows;
};

export const serviciosTop = async (db, { desde, hasta }, limite, barberoId = null) => {
  const { rows } = await db.query(
    `SELECT s.id, s.nombre, COUNT(*)::int AS cantidad, SUM(cs.precio)::int AS ingresos
     FROM cita_servicios cs
     JOIN citas c ON c.id = cs.cita_id
     JOIN servicios s ON s.id = cs.servicio_id
     WHERE c.fecha BETWEEN $1::date AND $2::date AND ${COMPLETADA} AND ($4::int IS NULL OR c.barbero_id = $4::int)
     GROUP BY s.id, s.nombre
     ORDER BY cantidad DESC, ingresos DESC, s.nombre ASC
     LIMIT $3`,
    [desde, hasta, limite, barberoId]
  );
  return rows;
};
