// Consultas del panel del barbero. Todas reciben el ejecutor `db` y el `barberoId`, que sale SIEMPRE de req.usuario
// (base de datos): ninguna lo toma de la query, el body ni los params. Las fechas salen como texto AAAA-MM-DD.
// "Ahora" ($2, 'AAAA-MM-DD HH:MM' en Bogotá) y la gracia de confirmación llegan como parámetros desde Node.
//
// Duración: la total guardada en la cita (suma de sus servicios). El fin de la cita es fecha + hora + duración.
// El nombre y los servicios salen del snapshot de cita_servicios (ver db/citaServicios.js).

import { COLUMNAS_SERVICIOS, unirServiciosDeCita, algunServicioCoincide } from './citaServicios.js';

const FIN_CITA = '((c.fecha + c.hora) + make_interval(mins => c.duracion_min))';
// Requiere $2 = ahora y $3 = minutos de gracia (ver utils/confirmacion.js).
const POR_CONFIRMAR = `c.estado = 'pendiente' AND (${FIN_CITA} + make_interval(mins => $3::int)) <= $2::timestamp`;

// Sin los servicios: para conteos y filtros. DESDE_CON_SERVICIOS añade nombre y lista de servicios de cada cita.
const DESDE = 'FROM citas c';
const DESDE_CON_SERVICIOS = `FROM citas c ${unirServiciosDeCita()}`;

export const contarPorConfirmar = async (db, barberoId, ahora, gracia) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total ${DESDE} WHERE c.barbero_id = $1 AND ${POR_CONFIRMAR}`,
    [barberoId, ahora, gracia]
  );
  return rows[0].total;
};

// De la más antigua a la más reciente. `termino_hace_min`: minutos desde que terminó la cita;
// `vencida_hace_min`: minutos desde que pasó el límite de confirmación (termino_hace_min - gracia).
export const listarPorConfirmar = async (db, barberoId, ahora, gracia, tope) => {
  const { rows } = await db.query(
    `SELECT c.id, c.cliente, ${COLUMNAS_SERVICIOS}, c.fecha::text AS fecha, c.hora::text AS hora,
            c.duracion_min,
            FLOOR(EXTRACT(EPOCH FROM ($2::timestamp - ${FIN_CITA})) / 60)::int AS termino_hace_min,
            FLOOR(EXTRACT(EPOCH FROM ($2::timestamp - ${FIN_CITA})) / 60)::int - $3::int AS vencida_hace_min
     ${DESDE_CON_SERVICIOS}
     WHERE c.barbero_id = $1 AND ${POR_CONFIRMAR}
     ORDER BY c.fecha ASC, c.hora ASC, c.id ASC
     LIMIT $4`,
    [barberoId, ahora, gracia, tope]
  );
  return rows;
};

// La pendiente más cercana que aún no ha empezado (hoy o días siguientes), o null.
export const proximaCita = async (db, barberoId, ahora) => {
  const { rows } = await db.query(
    `SELECT c.id, c.cliente, ${COLUMNAS_SERVICIOS}, c.fecha::text AS fecha, c.hora::text AS hora
     ${DESDE_CON_SERVICIOS}
     WHERE c.barbero_id = $1 AND c.estado = 'pendiente' AND (c.fecha + c.hora) >= $2::timestamp
     ORDER BY c.fecha ASC, c.hora ASC, c.id ASC
     LIMIT 1`,
    [barberoId, ahora]
  );
  return rows[0] ?? null;
};

export const agendaDelDia = async (db, barberoId, fecha, ahora, gracia) => {
  const { rows } = await db.query(
    `SELECT c.id, c.cliente, ${COLUMNAS_SERVICIOS}, c.fecha::text AS fecha, c.hora::text AS hora, c.estado,
            c.duracion_min, c.precio,
            (${POR_CONFIRMAR}) AS por_confirmar
     ${DESDE_CON_SERVICIOS}
     WHERE c.barbero_id = $1 AND c.fecha = $4::date
     ORDER BY c.hora ASC, c.id ASC`,
    [barberoId, ahora, gracia, fecha]
  );
  return rows;
};

// ---- Lista paginada de "Mis citas" (GET /api/barbero/citas) ----
export const PESTANAS_BARBERO = ['hoy', 'proximas', 'por_confirmar', 'completadas', 'canceladas', 'todas'];

// Qué citas entran en cada pestaña. $2 = ahora (Bogotá): "hoy" sale de él (no de CURRENT_DATE) y "próximas" son las
// pendientes que aún no empiezan. "por confirmar" es la misma condición única de más arriba.
const PREDICADO_PESTANA = {
  hoy: "(c.fecha = $2::timestamp::date AND c.estado <> 'cancelada')",
  proximas: "(c.estado = 'pendiente' AND (c.fecha + c.hora) >= $2::timestamp)",
  por_confirmar: `(${POR_CONFIRMAR})`,
  completadas: "(c.estado = 'completada')",
  canceladas: "(c.estado = 'cancelada')",
  todas: 'true',
};

const ORDEN_PESTANA = {
  hoy: 'c.hora ASC, c.id ASC',
  proximas: 'c.fecha ASC, c.hora ASC, c.id ASC',
  por_confirmar: 'c.fecha ASC, c.hora ASC, c.id ASC',
  completadas: 'c.fecha DESC, c.hora DESC, c.id DESC',
  canceladas: 'c.fecha DESC, c.hora DESC, c.id DESC',
  todas: 'c.fecha DESC, c.hora DESC, c.id DESC',
};

// `filtros`: { q (ya con %…% escapado), desde, hasta } opcionales; se aplican a la lista y también a los conteos de
// las pestañas (así lo que dice cada pestaña es lo que verás al abrirla). Devuelve { items, total, conteos }.
export const listarCitasBarbero = async (db, barberoId, { pestana, patron, desde, hasta, limite, offset }, ahora, gracia) => {
  const valores = [barberoId, ahora, gracia];
  const condiciones = ['c.barbero_id = $1'];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replace('?', `$${valores.length}`));
  };
  if (patron !== undefined) {
    valores.push(patron);
    const p = `$${valores.length}`;
    condiciones.push(`(c.cliente ILIKE ${p} ESCAPE '\\' OR ${algunServicioCoincide(p)})`);
  }
  if (desde !== undefined) agregar('c.fecha >= ?::date', desde);
  if (hasta !== undefined) agregar('c.fecha <= ?::date', hasta);
  const donde = condiciones.join(' AND ');

  const conteos = db.query(
    `SELECT ${PESTANAS_BARBERO.map((p) => `COUNT(*) FILTER (WHERE ${PREDICADO_PESTANA[p]})::int AS ${p}`).join(', ')}
     ${DESDE} WHERE ${donde}`,
    valores
  );
  const items = db.query(
    `SELECT c.id, c.cliente, ${COLUMNAS_SERVICIOS}, c.duracion_min,
            c.fecha::text AS fecha, c.hora::text AS hora, c.estado, c.precio, (${POR_CONFIRMAR}) AS por_confirmar
     ${DESDE_CON_SERVICIOS} WHERE ${donde} AND ${PREDICADO_PESTANA[pestana]}
     ORDER BY ${ORDEN_PESTANA[pestana]}
     LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, limite, offset]
  );
  const [resConteos, resItems] = await Promise.all([conteos, items]);
  return { items: resItems.rows, total: resConteos.rows[0][pestana], conteos: resConteos.rows[0] };
};
