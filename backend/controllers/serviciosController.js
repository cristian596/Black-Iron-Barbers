import { pool } from '../db/connection.js';

export const listarServicios = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, duracion_min, precio FROM servicios ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
