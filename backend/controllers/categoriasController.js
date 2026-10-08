import { pool } from '../db/connection.js';
import { leerParametroArea } from '../utils/areas.js';

// GET /api/categorias[?area=barberia|asesoria]. Sin area devuelve todas las activas (compatible). Con area solo las de
// esa área y total_servicios cuenta únicamente servicios activos de esa área. Valor inválido o repetido → 400.
export const listarCategorias = async (req, res, next) => {
  try {
    const { area, error } = leerParametroArea(req.query);
    if (error) return res.status(400).json({ error });

    const parametros = [];
    let filtroCategoria = '';
    let filtroServicio = '';
    if (area) {
      parametros.push(area);
      filtroCategoria = 'AND c.area = $1';
      filtroServicio = 'AND s.area = $1';
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.nombre, c.slug, c.orden, COUNT(s.id)::int AS total_servicios
       FROM categorias c
       LEFT JOIN servicios s ON s.categoria_id = c.id AND s.activo = true ${filtroServicio}
       WHERE c.activo = true ${filtroCategoria}
       GROUP BY c.id
       ORDER BY c.orden ASC, c.id ASC`,
      parametros
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
