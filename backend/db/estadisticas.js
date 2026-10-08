// Consultas de las estadísticas del admin. Reciben el ejecutor `db` (pool o cliente) para poder probarlas
// con distintas zonas horarias de sesión.
//
// Reglas comunes:
//  - citas.fecha es DATE en hora local de Bogotá: no se convierte nada. "Hoy" lo decide Node y llega como
//    parámetro; nunca CURRENT_DATE ni NOW(), que dependen de la zona del servidor Postgres.
//  - Ingresos = SUM(citas.precio) de las completadas (precio guardado en la cita, no el del catálogo). Es la suma de
//    los servicios de la cita; las cifras por cita (cortes, ingresos, ticket promedio) cuentan CITAS, no servicios.
//  - ÁREA de una cita (`a.area`): la de su servicio principal (citas.servicio_id). Coincide con la de su profesional
//    (lo exigen los triggers del esquema) salvo en las citas ANTERIORES a las asesorías (p. ej. los cortes que hizo
//    Camila antes de pasar a 'asesoria'): ahí manda el servicio, porque es lo que se cobró. Las cifras de barbería y
//    de asesoría no se mezclan: `cortes`/`ingresos_barberia` y `asesorias`/`ingresos_asesoria` van aparte.
//    `completadas` e `ingresos` son el total de ambas áreas.
//  - Ticket promedio: SOLO barbería en las cifras globales (admin). Con `barberoId` (un profesional, que atiende una
//    sola área) es el de sus propias citas completadas. En los dos casos excluye las de precio 0.
//  - serviciosTop cuenta servicios: una cita con 3 servicios suma 1 a cada uno (cantidad = líneas de cita_servicios,
//    ingresos = SUM del precio de la línea), no atribuye la cita entera a un solo servicio. `area` (opcional) filtra por
//    el área del servicio de la línea.
//  - Las fechas se devuelven como texto AAAA-MM-DD (pg convertiría un DATE a Date según la zona del proceso).
//  - Las series usan generate_series(0, n) sumado a una fecha: así no dependen de la zona de la sesión.

import { AREA_BARBERIA, AREA_ASESORIA } from '../utils/areas.js';

const COMPLETADA = "c.estado = 'completada'";
// Unir a la cita (alias `c`) su área como `a.area`. En series con LEFT JOIN de citas se usa la variante LEFT.
const CON_AREA = 'CROSS JOIN LATERAL (SELECT sp.area FROM servicios sp WHERE sp.id = c.servicio_id) a';
const CON_AREA_LEFT = 'LEFT JOIN LATERAL (SELECT sp.area FROM servicios sp WHERE sp.id = c.servicio_id) a ON true';

const DE_BARBERIA = `a.area = '${AREA_BARBERIA}'`;
const DE_ASESORIA = `a.area = '${AREA_ASESORIA}'`;

// Columnas de conteo e ingresos por área, comunes a las consultas de resumen y de series.
const CIFRAS_POR_AREA = `
  COALESCE(SUM(c.precio) FILTER (WHERE ${COMPLETADA}), 0)::int AS ingresos,
  COALESCE(SUM(c.precio) FILTER (WHERE ${COMPLETADA} AND ${DE_BARBERIA}), 0)::int AS ingresos_barberia,
  COALESCE(SUM(c.precio) FILTER (WHERE ${COMPLETADA} AND ${DE_ASESORIA}), 0)::int AS ingresos_asesoria,
  COUNT(c.id) FILTER (WHERE ${COMPLETADA})::int AS completadas,
  COUNT(c.id) FILTER (WHERE ${COMPLETADA} AND ${DE_BARBERIA})::int AS cortes,
  COUNT(c.id) FILTER (WHERE ${COMPLETADA} AND ${DE_ASESORIA})::int AS asesorias`;

// `barberoId` (opcional, en todas las consultas) limita las cifras a las citas de ese profesional; sin él son las de todos (estadísticas del admin).
export const resumenPeriodo = async (db, { desde, hasta }, barberoId = null) => {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE c.estado <> 'cancelada')::int AS citas,
       ${CIFRAS_POR_AREA},
       COUNT(*) FILTER (WHERE c.estado = 'cancelada')::int AS canceladas,
       COALESCE(ROUND(AVG(c.precio) FILTER (
         WHERE ${COMPLETADA} AND c.precio > 0 AND ($3::int IS NOT NULL OR ${DE_BARBERIA})
       )), 0)::int AS ticket_promedio
     FROM citas c ${CON_AREA}
     WHERE c.fecha BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR c.barbero_id = $3::int)`,
    [desde, hasta, barberoId]
  );
  return rows[0];
};

export const ingresosPorDia = async (db, desde, dias, barberoId = null) => {
  const { rows } = await db.query(
    `SELECT to_char($1::date + n, 'YYYY-MM-DD') AS fecha, ${CIFRAS_POR_AREA}
     FROM generate_series(0, $2::int - 1) AS n
     LEFT JOIN citas c ON c.fecha = $1::date + n AND ($3::int IS NULL OR c.barbero_id = $3::int)
     ${CON_AREA_LEFT}
     GROUP BY n
     ORDER BY n`,
    [desde, dias, barberoId]
  );
  return rows;
};

// `primerMes` es el día 1 del primer mes de la serie.
export const ingresosPorMes = async (db, primerMes, meses, barberoId = null) => {
  const { rows } = await db.query(
    `SELECT to_char(m.inicio, 'YYYY-MM') AS mes, ${CIFRAS_POR_AREA}
     FROM (
       SELECT ($1::date + make_interval(months => n))::date AS inicio
       FROM generate_series(0, $2::int - 1) AS n
     ) m
     LEFT JOIN citas c
       ON c.fecha >= m.inicio AND c.fecha < (m.inicio + interval '1 month')::date
      AND ($3::int IS NULL OR c.barbero_id = $3::int)
     ${CON_AREA_LEFT}
     GROUP BY m.inicio
     ORDER BY m.inicio`,
    [primerMes, meses, barberoId]
  );
  return rows;
};

// `area` (opcional): 'barberia' | 'asesoria' filtra por el área del servicio de cada línea; sin ella, todas.
export const serviciosTop = async (db, { desde, hasta }, limite, barberoId = null, area = null) => {
  const { rows } = await db.query(
    `SELECT s.id, s.nombre, COUNT(*)::int AS cantidad, SUM(cs.precio)::int AS ingresos
     FROM cita_servicios cs
     JOIN citas c ON c.id = cs.cita_id
     JOIN servicios s ON s.id = cs.servicio_id
     WHERE c.fecha BETWEEN $1::date AND $2::date AND ${COMPLETADA}
       AND ($4::int IS NULL OR c.barbero_id = $4::int)
       AND ($5::text IS NULL OR s.area = $5::text)
     GROUP BY s.id, s.nombre
     ORDER BY cantidad DESC, ingresos DESC, s.nombre ASC
     LIMIT $3`,
    [desde, hasta, limite, barberoId, area]
  );
  return rows;
};
