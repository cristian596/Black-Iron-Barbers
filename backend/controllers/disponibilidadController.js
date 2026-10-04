import { pool } from '../db/connection.js';
import {
  esFechaValida,
  esFechaHoy,
  generarHorasDisponibles,
  horaActualBogota,
  intervaloDentroDeHorario,
  minutosDesdeMedianoche,
} from '../utils/fechas.js';

const obtenerBarberosActivos = async () => {
  const { rows } = await pool.query('SELECT id FROM barberos WHERE activo = true ORDER BY id');
  return rows.map((row) => row.id);
};

const obtenerCitasOcupadas = async (barberoIds, fecha) => {
  if (barberoIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT barbero_id, TO_CHAR(hora, 'HH24:MI') AS hora, duracion_min
     FROM citas
     WHERE barbero_id = ANY($1) AND fecha = $2 AND estado <> 'cancelada'`,
    [barberoIds, fecha]
  );
  return rows;
};

const seSolapan = (inicioA, finA, inicioB, finB) => inicioA < finB && inicioB < finA;

const estaLibre = (barberoId, hora, duracionMin, ocupadas) => {
  const inicio = minutosDesdeMedianoche(hora);
  const fin = inicio + duracionMin;
  return !ocupadas.some(
    (cita) =>
      cita.barbero_id === barberoId &&
      seSolapan(inicio, fin, minutosDesdeMedianoche(cita.hora), minutosDesdeMedianoche(cita.hora) + cita.duracion_min)
  );
};

export const obtenerDisponibilidad = async (req, res, next) => {
  try {
    const { barbero, fecha, servicio } = req.query;

    if (!fecha || !servicio) {
      return res.status(400).json({ error: 'Los parámetros servicio y fecha son obligatorios' });
    }

    if (!esFechaValida(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }

    const servicioId = Number(servicio);
    if (!Number.isInteger(servicioId)) {
      return res.status(400).json({ error: 'El servicio debe ser un id numérico' });
    }

    const { rows: servicios } = await pool.query('SELECT duracion_min, activo FROM servicios WHERE id = $1', [servicioId]);
    if (servicios.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    if (!servicios[0].activo) {
      return res.status(400).json({ error: 'El servicio seleccionado no existe o no está disponible', codigo: 'SERVICIO_NO_DISPONIBLE' });
    }
    const duracionMin = servicios[0].duracion_min;

    let grid = generarHorasDisponibles().filter((hora) => intervaloDentroDeHorario(hora, duracionMin));

    if (esFechaHoy(fecha)) {
      const minutosActuales = horaActualBogota();
      grid = grid.filter((hora) => minutosDesdeMedianoche(hora) > minutosActuales);
    }

    if (barbero) {
      const barberoId = Number(barbero);
      if (!Number.isInteger(barberoId)) {
        return res.status(400).json({ error: 'El barbero debe ser un id numérico' });
      }

      const { rows: barberos } = await pool.query(
        'SELECT id FROM barberos WHERE id = $1 AND activo = true',
        [barberoId]
      );
      if (barberos.length === 0) {
        return res.status(404).json({ error: 'Barbero no encontrado o inactivo' });
      }

      const ocupadas = await obtenerCitasOcupadas([barberoId], fecha);
      const horas = grid.filter((hora) => estaLibre(barberoId, hora, duracionMin, ocupadas));

      return res.json({ barbero_id: barberoId, fecha, horas });
    }

    const barberoIds = await obtenerBarberosActivos();
    const ocupadas = await obtenerCitasOcupadas(barberoIds, fecha);
    const horas = grid.filter((hora) => barberoIds.some((id) => estaLibre(id, hora, duracionMin, ocupadas)));

    res.json({ barbero_id: null, fecha, horas });
  } catch (err) {
    next(err);
  }
};
