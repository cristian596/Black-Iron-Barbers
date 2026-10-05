import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/connection.js';
import { estadoContrasena } from '../utils/contrasenas.js';

// Valida la firma del JWT y además comprueba en la base que el usuario siga activo (y, si es barbero, que su
// barbero también lo esté). Sin esto, un token ya emitido seguiría funcionando hasta 8 h después de desactivar al
// empleado. Costo: una consulta por clave primaria en cada petición autenticada. El rol y el barbero_id salen de la
// base, no del token, así que un cambio de permisos también se aplica de inmediato.
const crearVerificador = ({ permitirCaducada }) => async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.slice('Bearer '.length);

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.usuario, u.rol, u.barbero_id, u.activo, u.contrasena_cambiada_en, b.activo AS barbero_activo
       FROM usuarios u
       LEFT JOIN barberos b ON b.id = u.barbero_id
       WHERE u.id = $1`,
      [payload.id]
    );
    const actual = rows[0];
    const vigente = actual && actual.activo && (actual.barbero_id === null || actual.barbero_activo);
    if (!vigente) {
      return res.status(401).json({ error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.', codigo: 'SESION_INVALIDA' });
    }
    // Solo los barberos caducan; el admin queda exento (vigencia null).
    const vigencia = actual.rol === 'barbero' ? estadoContrasena(actual.contrasena_cambiada_en) : null;
    if (vigencia?.estado === 'caducada' && !permitirCaducada) {
      return res.status(403).json({
        error: 'Tu contraseña caducó. Cámbiala para seguir usando el panel.',
        codigo: 'CONTRASENA_CADUCADA',
      });
    }
    req.usuario = { ...payload, id: actual.id, usuario: actual.usuario, rol: actual.rol, barbero_id: actual.barbero_id, vigencia };
    next();
  } catch (err) {
    next(err);
  }
};

// Con la contraseña caducada el barbero puede iniciar sesión, pero todo lo demás responde 403 CONTRASENA_CADUCADA.
export const verificarToken = crearVerificador({ permitirCaducada: false });

// Solo para lo imprescindible con la contraseña caducada: cambiarla y consultar el estado de la sesión.
export const verificarTokenPermitiendoCaducada = crearVerificador({ permitirCaducada: true });
