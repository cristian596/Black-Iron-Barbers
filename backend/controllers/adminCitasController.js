import { pool } from '../db/connection.js';
import { ahoraBogota } from '../utils/fechas.js';
import { esFechaCalendario } from '../utils/periodos.js';
import { validarParametros, leerEntero, escaparLike } from '../utils/parametrosQuery.js';

const PARAMETROS = ['pestana', 'q', 'desde', 'hasta', 'barbero', 'pagina', 'limite'];
const PESTANAS = ['proximas', 'todas', 'canceladas'];
const LIMITE_POR_DEFECTO = 10;
const LIMITE_MAXIMO = 50;
const PAGINA_MAXIMA = 1_000_000;
const MAX_LONGITUD_Q = 100;

const DESDE = `
  FROM citas c
  JOIN servicios s ON s.id = c.servicio_id
  JOIN barberos b ON b.id = c.barbero_id`;

// Lista paginada para el admin. Las pendientes de días pasados salen con `vencida: true` y no entran en
// "proximas" (que son las pendientes que aún no empiezan), pero sí en "todas".
export const listarCitasAdmin = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, PARAMETROS);
    if (errorParametros) return res.status(400).json({ error: errorParametros });

    const { pestana = 'todas', q, desde, hasta, barbero, pagina, limite } = req.query;

    if (!PESTANAS.includes(pestana)) {
      return res.status(400).json({ error: `El parámetro 'pestana' debe ser uno de: ${PESTANAS.join(', ')}` });
    }
    if (q !== undefined && q.trim().length > MAX_LONGITUD_Q) {
      return res.status(400).json({ error: `El parámetro 'q' no puede superar ${MAX_LONGITUD_Q} caracteres` });
    }
    for (const [nombre, valor] of [['desde', desde], ['hasta', hasta]]) {
      if (valor !== undefined && !esFechaCalendario(valor)) {
        return res.status(400).json({ error: `El parámetro '${nombre}' debe ser una fecha válida AAAA-MM-DD` });
      }
    }
    if (desde !== undefined && hasta !== undefined && desde > hasta) {
      return res.status(400).json({ error: "El parámetro 'desde' no puede ser posterior a 'hasta'" });
    }

    let barberoId;
    if (barbero !== undefined) {
      barberoId = leerEntero(barbero, 1);
      if (Number.isNaN(barberoId)) return res.status(400).json({ error: 'El filtro barbero debe ser un id numérico' });
    }
    let paginaActual = 1;
    if (pagina !== undefined) {
      paginaActual = leerEntero(pagina, 1, PAGINA_MAXIMA);
      if (Number.isNaN(paginaActual)) {
        return res.status(400).json({ error: `El parámetro 'pagina' debe ser un entero entre 1 y ${PAGINA_MAXIMA}` });
      }
    }
    let tamano = LIMITE_POR_DEFECTO;
    if (limite !== undefined) {
      tamano = leerEntero(limite, 1, LIMITE_MAXIMO);
      if (Number.isNaN(tamano)) {
        return res.status(400).json({ error: `El parámetro 'limite' debe ser un entero entre 1 y ${LIMITE_MAXIMO}` });
      }
    }

    const ahora = ahoraBogota();
    const condiciones = [];
    const valores = [];
    const agregar = (sql, valor) => {
      valores.push(valor);
      condiciones.push(sql.replace('?', `$${valores.length}`));
    };

    if (pestana === 'proximas') {
      condiciones.push("c.estado = 'pendiente'");
      agregar('(c.fecha + c.hora) >= ?::timestamp', ahora);
    } else if (pestana === 'canceladas') {
      condiciones.push("c.estado = 'cancelada'");
    }
    if (desde !== undefined) agregar('c.fecha >= ?::date', desde);
    if (hasta !== undefined) agregar('c.fecha <= ?::date', hasta);
    if (barberoId !== undefined) agregar('c.barbero_id = ?', barberoId);
    if (q?.trim()) {
      valores.push(`%${escaparLike(q.trim())}%`);
      const p = `$${valores.length}`;
      condiciones.push(
        `(c.cliente ILIKE ${p} ESCAPE '\\' OR s.nombre ILIKE ${p} ESCAPE '\\' OR b.nombre ILIKE ${p} ESCAPE '\\')`
      );
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const orden = pestana === 'proximas'
      ? 'c.fecha ASC, c.hora ASC, c.id ASC'
      : 'c.fecha DESC, c.hora DESC, c.id DESC';

    const iAhora = valores.length + 1;
    const [{ rows: items }, { rows: conteo }] = await Promise.all([
      pool.query(
        `SELECT c.id, c.cliente, c.correo, c.telefono, c.fecha::text AS fecha, c.hora::text AS hora, c.estado,
                c.duracion_min, c.precio, c.servicio_id, c.barbero_id,
                s.nombre AS servicio_nombre, b.nombre AS barbero_nombre,
                (c.estado = 'pendiente' AND (c.fecha + c.hora) < $${iAhora}::timestamp) AS vencida
         ${DESDE} ${where}
         ORDER BY ${orden}
         LIMIT $${iAhora + 1} OFFSET $${iAhora + 2}`,
        [...valores, ahora, tamano, (paginaActual - 1) * tamano]
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${DESDE} ${where}`, valores),
    ]);

    res.json({ items, total: conteo[0].total, pagina: paginaActual, limite: tamano });
  } catch (err) {
    next(err);
  }
};
