import { pool } from '../db/connection.js';
import { esFechaValida, esFechaHoy, generarHorasDisponibles } from '../utils/fechas.js';

export const obtenerDisponibilidad = async (req, res, next) => {
  try {
    const { barbero, fecha } = req.query;

    if (!barbero || !fecha) {
      return res.status(400).json({ error: 'Los parámetros barbero y fecha son obligatorios' });
    }

    const barberoId = Number(barbero);
    if (!Number.isInteger(barberoId)) {
      return res.status(400).json({ error: 'El barbero debe ser un id numérico' });
    }

    if (!esFechaValida(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }

    const { rows: barberos } = await pool.query(
      'SELECT id FROM barberos WHERE id = $1 AND activo = true',
      [barberoId]
    );
    if (barberos.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado o inactivo' });
    }

    const { rows: ocupadas } = await pool.query(
      `SELECT TO_CHAR(hora, 'HH24:MI') AS hora FROM citas
       WHERE barbero_id = $1 AND fecha = $2 AND estado != 'cancelada'`,
      [barberoId, fecha]
    );
    const horasOcupadas = new Set(ocupadas.map((cita) => cita.hora));

    let horas = generarHorasDisponibles().filter((hora) => !horasOcupadas.has(hora));

    if (esFechaHoy(fecha)) {
      const ahora = new Date();
      const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
      horas = horas.filter((hora) => {
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m > minutosActuales;
      });
    }

    res.json({ barbero_id: barberoId, fecha, horas });
  } catch (err) {
    next(err);
  }
};
