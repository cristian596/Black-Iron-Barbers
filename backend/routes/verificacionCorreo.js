import { Router } from 'express';
import { omitirLimitadores } from '../config/entorno.js';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { solicitar, confirmar } from '../controllers/verificacionCorreoController.js';

const router = Router();

// Límites POR IP, en la memoria del proceso (se reinician con el servidor y, sin `trust proxy` bien configurado, detrás
// de un proxy todos comparten la IP del proxy). Son un freno adicional: los límites que de verdad protegen a cada correo
// (60 s entre solicitudes, 5 por hora, 5 intentos por código) viven en la base de datos. Configurables por entorno; se
// omiten bajo NODE_ENV=test salvo FORZAR_RATE_LIMIT_PRUEBA=true.
const crearLimite = ({ ventanaMs, limite, mensaje }) =>
  rateLimit({
    windowMs: ventanaMs,
    limit: limite,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (req, res, next, opciones) => {
      const reintentarEnSeg = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000));
      res.status(opciones.statusCode).json({ error: mensaje, codigo: 'DEMASIADOS_INTENTOS', reintentar_en_seg: reintentarEnSeg });
    },
    skip: () => omitirLimitadores(),
  });

const limitarSolicitudes = crearLimite({
  ventanaMs: 60 * 60 * 1000,
  limite: Number(process.env.LIMITE_VERIF_SOLICITAR_IP_RATE) || 20,
  mensaje: 'Demasiadas solicitudes de código, intenta más tarde',
});
const limitarConfirmaciones = crearLimite({
  ventanaMs: 15 * 60 * 1000,
  limite: Number(process.env.LIMITE_VERIF_CONFIRMAR_IP_RATE) || 30,
  mensaje: 'Demasiados intentos de verificación, intenta más tarde',
});

router.post('/solicitar', limitarSolicitudes, solicitar);
router.post('/confirmar', limitarConfirmaciones, confirmar);

export default router;
