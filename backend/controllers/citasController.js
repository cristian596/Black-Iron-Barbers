import { pool } from '../db/connection.js';
import { esFechaValida, esHoraValida, esFechaAnterior, horaDentroDeHorario } from '../utils/fechas.js';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESTADOS_VALIDOS = ['pendiente', 'completada', 'cancelada'];

export const crearCita = async (req, res, next) => {
  try {
    const { cliente, correo, servicio_id, barbero_id, fecha, hora } = req.body;

    if (!cliente || typeof cliente !== 'string' || cliente.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }
    if (!correo || typeof correo !== 'string' || !REGEX_CORREO.test(correo)) {
      return res.status(400).json({ error: 'El correo no es válido' });
    }

    const servicioId = Number(servicio_id);
    const barberoId = Number(barbero_id);

    if (!Number.isInteger(servicioId)) {
      return res.status(400).json({ error: 'El servicio es obligatorio' });
    }
    if (!Number.isInteger(barberoId)) {
      return res.status(400).json({ error: 'El barbero es obligatorio' });
    }
    if (!esFechaValida(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }
    if (esFechaAnterior(fecha)) {
      return res.status(400).json({ error: 'No se pueden agendar citas en fechas pasadas' });
    }
    if (!esHoraValida(hora) || !horaDentroDeHorario(hora)) {
      return res.status(400).json({ error: 'La hora debe estar dentro del horario de atención' });
    }

    const { rows: servicios } = await pool.query('SELECT id FROM servicios WHERE id = $1', [servicioId]);
    if (servicios.length === 0) {
      return res.status(400).json({ error: 'El servicio seleccionado no existe' });
    }

    const { rows: barberos } = await pool.query(
      'SELECT id FROM barberos WHERE id = $1 AND activo = true',
      [barberoId]
    );
    if (barberos.length === 0) {
      return res.status(400).json({ error: 'El barbero seleccionado no existe o no está activo' });
    }

    const { rows } = await pool.query(
      `INSERT INTO citas (cliente, correo, servicio_id, barbero_id, fecha, hora)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, cliente, correo, servicio_id, barbero_id, fecha, hora, estado`,
      [cliente.trim(), correo, servicioId, barberoId, fecha, hora]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese horario ya está reservado para este barbero, elige otro' });
    }
    next(err);
  }
};

export const listarCitas = async (req, res, next) => {
  try {
    const { rol, barbero_id: barberoToken } = req.usuario;
    const { estado, barbero, fecha } = req.query;

    const condiciones = [];
    const valores = [];

    if (rol === 'barbero') {
      valores.push(barberoToken);
      condiciones.push(`citas.barbero_id = $${valores.length}`);
    } else if (rol === 'admin' && barbero) {
      const barberoId = Number(barbero);
      if (!Number.isInteger(barberoId)) {
        return res.status(400).json({ error: 'El filtro barbero debe ser un id numérico' });
      }
      valores.push(barberoId);
      condiciones.push(`citas.barbero_id = $${valores.length}`);
    }

    if (estado) {
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: 'Estado de filtro inválido' });
      }
      valores.push(estado);
      condiciones.push(`citas.estado = $${valores.length}`);
    }

    if (fecha) {
      if (!esFechaValida(fecha)) {
        return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
      }
      valores.push(fecha);
      condiciones.push(`citas.fecha = $${valores.length}`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT citas.id, citas.cliente, citas.correo, citas.fecha, citas.hora, citas.estado,
              citas.creada_en, citas.servicio_id, citas.barbero_id,
              servicios.nombre AS servicio_nombre, barberos.nombre AS barbero_nombre
       FROM citas
       JOIN servicios ON servicios.id = citas.servicio_id
       JOIN barberos ON barberos.id = citas.barbero_id
       ${where}
       ORDER BY citas.fecha, citas.hora`,
      valores
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

export const actualizarCita = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado, barbero_id } = req.body;
    const { rol, barbero_id: barberoToken } = req.usuario;

    const citaId = Number(id);
    if (!Number.isInteger(citaId)) {
      return res.status(400).json({ error: 'Id de cita inválido' });
    }

    if (estado === undefined && barbero_id === undefined) {
      return res.status(400).json({ error: 'Debes enviar al menos estado o barbero_id' });
    }

    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    if (barbero_id !== undefined && rol !== 'admin') {
      return res.status(403).json({ error: 'Solo un administrador puede reasignar el barbero' });
    }

    const { rows: citas } = await pool.query('SELECT id, barbero_id FROM citas WHERE id = $1', [citaId]);
    const cita = citas[0];

    if (!cita) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (rol === 'barbero' && cita.barbero_id !== barberoToken) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    let nuevoBarberoId = cita.barbero_id;
    if (barbero_id !== undefined) {
      nuevoBarberoId = Number(barbero_id);
      if (!Number.isInteger(nuevoBarberoId)) {
        return res.status(400).json({ error: 'El barbero_id debe ser un id numérico' });
      }
      const { rows: barberos } = await pool.query(
        'SELECT id FROM barberos WHERE id = $1 AND activo = true',
        [nuevoBarberoId]
      );
      if (barberos.length === 0) {
        return res.status(400).json({ error: 'El barbero seleccionado no existe o no está activo' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE citas
       SET estado = COALESCE($1, estado), barbero_id = $2
       WHERE id = $3
       RETURNING id, cliente, correo, servicio_id, barbero_id, fecha, hora, estado`,
      [estado ?? null, nuevoBarberoId, citaId]
    );

    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese barbero ya tiene una cita en esa fecha y hora' });
    }
    next(err);
  }
};
