import { pool } from '../db/connection.js';

export const listarBarberos = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, cargo, especialidad, foto FROM barberos WHERE activo = true ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
