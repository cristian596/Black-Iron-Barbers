// Token de sesión (JWT HS256). Un solo lugar para firmarlo: el login y el cambio de contraseña usan la misma función.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const VIGENCIA_TOKEN_SEG = 8 * 60 * 60;

// `usuario`: fila con id, usuario, rol, barbero_id y version_token. `v` permite revocar todas las sesiones de un usuario.
export const firmarTokenSesion = (usuario) =>
  jwt.sign(
    { id: usuario.id, usuario: usuario.usuario, rol: usuario.rol, barbero_id: usuario.barbero_id, v: usuario.version_token ?? 0 },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: VIGENCIA_TOKEN_SEG }
  );
