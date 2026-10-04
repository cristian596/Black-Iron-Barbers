import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection.js';
import { env } from '../config/env.js';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

export const login = async (req, res, next) => {
  try {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }

    const { rows } = await pool.query(
      'SELECT id, usuario, contrasena, rol, barbero_id, activo FROM usuarios WHERE usuario = $1',
      [usuario]
    );
    const usuarioEncontrado = rows[0];

    if (!usuarioEncontrado || !usuarioEncontrado.activo) {
      return res.status(401).json({ error: MENSAJE_CREDENCIALES_INVALIDAS });
    }

    const contrasenaValida = await bcrypt.compare(contrasena, usuarioEncontrado.contrasena);

    if (!contrasenaValida) {
      return res.status(401).json({ error: MENSAJE_CREDENCIALES_INVALIDAS });
    }

    const token = jwt.sign(
      {
        id: usuarioEncontrado.id,
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol,
        barbero_id: usuarioEncontrado.barbero_id,
      },
      env.jwtSecret,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuarioEncontrado.id,
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol,
        barbero_id: usuarioEncontrado.barbero_id,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const cambiarContrasena = async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;

    if (!actual || !nueva || nueva.length < 8) {
      return res.status(400).json({ error: 'Datos inválidos: la nueva contraseña debe tener al menos 8 caracteres' });
    }

    const { rows } = await pool.query('SELECT contrasena FROM usuarios WHERE id = $1', [req.usuario.id]);
    const usuarioActual = rows[0];

    if (!usuarioActual) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const contrasenaValida = await bcrypt.compare(actual, usuarioActual.contrasena);

    if (!contrasenaValida) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    const hash = await bcrypt.hash(nueva, 10);
    await pool.query('UPDATE usuarios SET contrasena = $1 WHERE id = $2', [hash, req.usuario.id]);

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
};
