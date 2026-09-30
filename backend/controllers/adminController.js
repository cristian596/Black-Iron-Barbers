import bcrypt from 'bcryptjs';
import { pool } from '../db/connection.js';

export const obtenerResumen = async (req, res, next) => {
  try {
    const [{ rows: porEstado }, { rows: porBarbero }] = await Promise.all([
      pool.query('SELECT estado, COUNT(*)::int AS total FROM citas GROUP BY estado'),
      pool.query(
        `SELECT barberos.id AS barbero_id, barberos.nombre AS barbero_nombre, COUNT(citas.id)::int AS total
         FROM barberos
         LEFT JOIN citas ON citas.barbero_id = barberos.id
         GROUP BY barberos.id, barberos.nombre
         ORDER BY barberos.nombre`
      ),
    ]);

    res.json({ porEstado, porBarbero });
  } catch (err) {
    next(err);
  }
};

export const crearUsuario = async (req, res, next) => {
  try {
    const { usuario, contrasena, barbero_id } = req.body;

    if (!usuario || typeof usuario !== 'string' || usuario.trim().length === 0) {
      return res.status(400).json({ error: 'El usuario es obligatorio' });
    }
    if (!contrasena || typeof contrasena !== 'string' || contrasena.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const barberoId = Number(barbero_id);
    if (!Number.isInteger(barberoId)) {
      return res.status(400).json({ error: 'El barbero_id es obligatorio' });
    }

    const { rows: barberos } = await pool.query('SELECT id FROM barberos WHERE id = $1', [barberoId]);
    if (barberos.length === 0) {
      return res.status(400).json({ error: 'El barbero seleccionado no existe' });
    }

    const hash = await bcrypt.hash(contrasena, 10);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id)
       VALUES ($1, $2, 'barbero', $3)
       RETURNING id, usuario, rol, barbero_id, activo`,
      [usuario.trim(), hash, barberoId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    }
    next(err);
  }
};

export const actualizarUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contrasena, activo } = req.body;

    const usuarioId = Number(id);
    if (!Number.isInteger(usuarioId)) {
      return res.status(400).json({ error: 'Id de usuario inválido' });
    }

    if (contrasena === undefined && activo === undefined) {
      return res.status(400).json({ error: 'Debes enviar contrasena o activo' });
    }
    if (contrasena !== undefined && (typeof contrasena !== 'string' || contrasena.length < 8)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (activo !== undefined && typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo activo debe ser booleano' });
    }

    const hash = contrasena !== undefined ? await bcrypt.hash(contrasena, 10) : null;

    const { rows } = await pool.query(
      `UPDATE usuarios
       SET contrasena = COALESCE($1, contrasena),
           activo = COALESCE($2, activo)
       WHERE id = $3
       RETURNING id, usuario, rol, barbero_id, activo`,
      [hash, activo ?? null, usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};
