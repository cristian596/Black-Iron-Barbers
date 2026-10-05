import bcrypt from 'bcryptjs';
import { pool } from '../db/connection.js';
import { longitudContrasenaValida, MIN_CONTRASENA, MAX_CONTRASENA } from '../utils/contrasenas.js';

export const listarUsuarios = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT usuarios.id, usuarios.usuario, usuarios.rol, usuarios.activo,
              usuarios.barbero_id, barberos.nombre AS barbero_nombre
       FROM usuarios
       JOIN barberos ON barberos.id = usuarios.barbero_id
       WHERE usuarios.rol = 'barbero'
       ORDER BY barberos.nombre, usuarios.id`
    );
    res.json(rows);
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
    if (!longitudContrasenaValida(contrasena)) {
      return res.status(400).json({ error: `La contraseña debe tener entre ${MIN_CONTRASENA} y ${MAX_CONTRASENA} caracteres` });
    }

    const barberoId = Number(barbero_id);
    if (!Number.isInteger(barberoId)) {
      return res.status(400).json({ error: 'El barbero_id es obligatorio' });
    }

    const { rows: barberos } = await pool.query('SELECT id, activo FROM barberos WHERE id = $1', [barberoId]);
    if (barberos.length === 0) {
      return res.status(400).json({ error: 'El barbero seleccionado no existe' });
    }
    if (!barberos[0].activo) {
      return res.status(409).json({ error: 'El barbero está inactivo: reactívalo en Empleados antes de crearle acceso', codigo: 'BARBERO_INACTIVO' });
    }

    const hash = await bcrypt.hash(contrasena, 10);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, contrasena_cambiada_en)
       VALUES ($1, $2, 'barbero', $3, $4)
       RETURNING id, usuario, rol, barbero_id, activo`,
      [usuario.trim(), hash, barberoId, new Date()]
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
    if (contrasena !== undefined && !longitudContrasenaValida(contrasena)) {
      return res.status(400).json({ error: `La contraseña debe tener entre ${MIN_CONTRASENA} y ${MAX_CONTRASENA} caracteres` });
    }
    if (activo !== undefined && typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo activo debe ser booleano' });
    }

    if (activo === true) {
      // Un usuario activo con su barbero inactivo sería un estado inconsistente: se reactiva desde Empleados.
      const { rows: ligado } = await pool.query(
        `SELECT 1 FROM usuarios JOIN barberos ON barberos.id = usuarios.barbero_id WHERE usuarios.id = $1 AND barberos.activo = false`,
        [usuarioId]
      );
      if (ligado.length > 0) {
        return res.status(409).json({ error: 'El barbero está inactivo: reactívalo en Empleados', codigo: 'BARBERO_INACTIVO' });
      }
    }

    const hash = contrasena !== undefined ? await bcrypt.hash(contrasena, 10) : null;

    const { rows } = await pool.query(
      `UPDATE usuarios
       SET contrasena = COALESCE($1, contrasena),
           activo = COALESCE($2, activo),
           contrasena_cambiada_en = COALESCE($4, contrasena_cambiada_en)
       WHERE id = $3
       RETURNING id, usuario, rol, barbero_id, activo`,
      [hash, activo ?? null, usuarioId, hash ? new Date() : null] // fijar una contraseña reinicia los 60 días
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};
