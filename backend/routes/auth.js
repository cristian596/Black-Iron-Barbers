import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, cambiarContrasena, obtenerSesion } from '../controllers/authController.js';
import { verificarTokenPermitiendoCaducada } from '../middlewares/verificarToken.js';

const router = Router();

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // El cuerpo lleva el tiempo restante: el CORS no expone Retry-After al navegador (otro origen en desarrollo), así
  // que el front lee `reintentar_en_seg` del JSON en vez de depender de cabeceras.
  handler: (req, res, next, opciones) => {
    const reintentarEnSeg = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000));
    res.status(opciones.statusCode).json({
      error: 'Demasiados intentos de inicio de sesión, intenta más tarde',
      codigo: 'DEMASIADOS_INTENTOS',
      reintentar_en_seg: reintentarEnSeg,
    });
  },
  // Como en citas: las pruebas inician sesión decenas de veces; FORZAR_RATE_LIMIT_PRUEBA=true lo reactiva.
  skip: () => process.env.NODE_ENV === 'test' && process.env.FORZAR_RATE_LIMIT_PRUEBA !== 'true',
});

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
