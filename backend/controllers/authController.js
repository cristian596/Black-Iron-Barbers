import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection.js';
import { env } from '../config/env.js';
import { estadoContrasena, longitudContrasenaValida, MIN_CONTRASENA, MAX_CONTRASENA } from '../utils/contrasenas.js';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

export const login = async (req, res, next) => {
  try {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }

    const { rows } = await pool.query(
      'SELECT id, usuario, contrasena, rol, barbero_id, activo, contrasena_cambiada_en FROM usuarios WHERE usuario = $1',
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
      // Estado de la contraseña (solo barberos; el admin no caduca). Con "caducada" el token solo sirve para cambiarla.
      vigencia: usuarioEncontrado.rol === 'barbero' ? estadoContrasena(usuarioEncontrado.contrasena_cambiada_en) : null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/sesion → quién es el usuario de la sesión y el estado de su contraseña (null para el admin).
export const obtenerSesion = (req, res) => {
  const { id, usuario, rol, barbero_id, vigencia } = req.usuario;
  res.json({ usuario: { id, usuario, rol, barbero_id }, vigencia });
};

const fallo = (res, estado, codigo, error, extra = {}) => res.status(estado).json({ error, codigo, ...extra });

// PATCH /api/auth/contrasena  { actual, nueva }
// El barbero solo puede cambiarla cuando está por_vencer o caducada (se aplica aquí, no solo en el front); el admin
// la cambia cuando quiera. verificarToken ya calculó req.usuario.vigencia.
export const cambiarContrasena = async (req, res, next) => {
  try {
    if (req.usuario.vigencia?.estado === 'vigente') {
      return fallo(res, 403, 'CAMBIO_NO_PERMITIDO', 'Tu contraseña aún está vigente. Podrás cambiarla cuando falten 2 días o menos para que caduque, o pídele al administrador que la restablezca.', {
        vigencia: req.usuario.vigencia,
      });
    }

    const { actual, nueva } = req.body ?? {};

    if (typeof actual !== 'string' || actual === '') {
      return fallo(res, 400, 'DATOS_INVALIDOS', 'La contraseña actual es obligatoria', { campo: 'actual' });
    }
    if (!longitudContrasenaValida(nueva)) {
      return fallo(res, 400, 'DATOS_INVALIDOS', `La nueva contraseña debe tener entre ${MIN_CONTRASENA} y ${MAX_CONTRASENA} caracteres`, { campo: 'nueva' });
    }

    const { rows } = await pool.query('SELECT contrasena FROM usuarios WHERE id = $1', [req.usuario.id]);
    const usuarioActual = rows[0];

    if (!usuarioActual) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 400 y no 401: un 401 con token hace que el front cierre la sesión, y equivocarse al teclear no debe sacar al usuario.
    if (!(await bcrypt.compare(actual, usuarioActual.contrasena))) {
      return fallo(res, 400, 'CONTRASENA_ACTUAL_INCORRECTA', 'La contraseña actual no es correcta', { campo: 'actual' });
    }
    if (nueva === actual) {
      return fallo(res, 400, 'CONTRASENA_IGUAL', 'La nueva contraseña debe ser distinta de la actual', { campo: 'nueva' });
    }

    const ahora = new Date();
    const hash = await bcrypt.hash(nueva, 10);
    await pool.query('UPDATE usuarios SET contrasena = $1, contrasena_cambiada_en = $2 WHERE id = $3', [hash, ahora, req.usuario.id]);

    res.json({
      mensaje: 'Contraseña actualizada correctamente',
      vigencia: req.usuario.rol === 'barbero' ? estadoContrasena(ahora, ahora) : null,
    });
  } catch (err) {
    next(err);
  }
};
