import { pool } from '../db/connection.js';

// Devuelve a TODO el personal activo, con su `area` ('barberia' | 'asesoria'). Cada consumidor filtra lo que necesite:
// la reserva de cortes solo ofrece area 'barberia'; "Nuestro Equipo" muestra a todos.
export const listarBarberos = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, cargo, especialidad, foto, area FROM barberos WHERE activo = true ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
