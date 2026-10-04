import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/connection.js';

// Valida la firma del JWT y además comprueba en la base que el usuario siga activo (y, si es barbero, que su
// barbero también lo esté). Sin esto, un token ya emitido seguiría funcionando hasta 8 h después de desactivar al
// empleado. Costo: una consulta por clave primaria en cada petición autenticada. El rol y el barbero_id salen de la
// base, no del token, así que un cambio de permisos también se aplica de inmediato.
export const verificarToken = async (req, res, next) => {
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
      `SELECT u.id, u.usuario, u.rol, u.barbero_id, u.activo, b.activo AS barbero_activo
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
    req.usuario = { ...payload, id: actual.id, usuario: actual.usuario, rol: actual.rol, barbero_id: actual.barbero_id };
    next();
  } catch (err) {
    next(err);
  }
};
