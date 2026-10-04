import { pool } from '../db/connection.js';

export const listarCategorias = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.nombre, c.slug, c.orden, COUNT(s.id)::int AS total_servicios
       FROM categorias c
       LEFT JOIN servicios s ON s.categoria_id = c.id AND s.activo = true
       WHERE c.activo = true
       GROUP BY c.id
       ORDER BY c.orden ASC, c.id ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
