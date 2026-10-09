import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { login, cambiarContrasena, obtenerSesion } from '../controllers/authController.js';
import { verificarTokenPermitiendoCaducada } from '../middlewares/verificarToken.js';

const router = Router();

// Login: DOS límites que cuentan solo los intentos FALLIDOS (un login correcto no gasta cupo):
//  1) por IP + usuario normalizado (10 / 15 min): frena adivinar la contraseña de una cuenta sin que quien se equivoca
//     bloquee a los demás usuarios de la misma IP (en desarrollo, tu PC; detrás de un proxy, el proxy).
//  2) por IP (100 / 15 min): freno contra probar muchos usuarios distintos desde una misma IP.
// No hay límite por usuario en todas las IPs: permitiría dejar fuera a un barbero a propósito.
// Valores configurables por entorno (las pruebas fijan límites bajos). Viven en la memoria del proceso.
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const LIMITE_LOGIN_USUARIO = Number(process.env.LIMITE_LOGIN_USUARIO_RATE) || 10;
const LIMITE_LOGIN_IP = Number(process.env.LIMITE_LOGIN_IP_RATE) || 100;
const LARGO_MAX_CLAVE_USUARIO = 100; // acota la memoria que puede ocupar un nombre de usuario enorme

// Usuario normalizado (trim + minúsculas) para que "Danny" y " danny " sean la misma clave. Sin usuario (o que no sea
// texto) se usa un valor fijo: queda limitado solo por IP, sin romper ni dejar pasar sin límite.
const usuarioParaClave = (req) => {
  const usuario = req.body?.usuario;
  if (typeof usuario !== 'string') return '';
  return usuario.trim().toLowerCase().slice(0, LARGO_MAX_CLAVE_USUARIO);
};

const omitirEnPruebas = () => process.env.NODE_ENV === 'test' && process.env.FORZAR_RATE_LIMIT_PRUEBA !== 'true';

// El cuerpo lleva el tiempo restante: el CORS no expone Retry-After al navegador (otro origen en desarrollo), así
// que el front lee `reintentar_en_seg` del JSON en vez de depender de cabeceras. Mismo mensaje en ambos límites: no
// revela si el usuario existe.
const respuestaLimiteLogin = (req, res, next, opciones) => {
  const reintentarEnSeg = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000));
  res.status(opciones.statusCode).json({
    error: 'Demasiados intentos de inicio de sesión, intenta más tarde',
    codigo: 'DEMASIADOS_INTENTOS',
    reintentar_en_seg: reintentarEnSeg,
  });
};

const configuracionLoginComun = {
  windowMs: VENTANA_LOGIN_MS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respuestaLimiteLogin,
  // Como en citas: las pruebas inician sesión decenas de veces; FORZAR_RATE_LIMIT_PRUEBA=true lo reactiva.
  skip: omitirEnPruebas,
};

const limitarLoginPorUsuario = rateLimit({
  ...configuracionLoginComun,
  limit: LIMITE_LOGIN_USUARIO,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${usuarioParaClave(req)}`,
});

const limitarLoginPorIp = rateLimit({
  ...configuracionLoginComun,
  limit: LIMITE_LOGIN_IP,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Primero el de usuario: si ya está bloqueado, la petición no llega al de IP y no gasta su cupo.
const limitarLogin = [limitarLoginPorUsuario, limitarLoginPorIp];

// Cambiar la contraseña exige la actual: sin límite, quien robe un token podría adivinarla a golpe de intentos y
// quedarse con la cuenta más allá de las 8 h del token. Cuenta solo los intentos fallidos (los cambios correctos no
// gastan cupo) y por usuario, no por IP. Va después de verificarToken para conocer al usuario. En pruebas se omite
// salvo FORZAR_RATE_LIMIT_PRUEBA=true (igual que el de citas).
const limitarCambioContrasena = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `usuario-${req.usuario.id}`,
  message: { error: 'Demasiados intentos fallidos al cambiar la contraseña, intenta más tarde', codigo: 'DEMASIADOS_INTENTOS' },
  skip: () => process.env.NODE_ENV === 'test' && process.env.FORZAR_RATE_LIMIT_PRUEBA !== 'true',
});

router.post('/login', limitarLogin, login);
// Con la contraseña caducada solo estas dos rutas aceptan el token.
router.get('/sesion', verificarTokenPermitiendoCaducada, obtenerSesion);
router.patch('/contrasena', verificarTokenPermitiendoCaducada, limitarCambioContrasena, cambiarContrasena);

export default router;
