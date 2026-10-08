import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { comprobarAsesoriaGratis } from '../controllers/asesoriasController.js';

const router = Router();

// Límite estricto por IP: esta comprobación es un posible oráculo ("este correo/teléfono ya usó la gratis"). Mismo patrón
// que los demás limitadores: configurable para forzar un límite bajo en pruebas y omitido bajo NODE_ENV=test salvo
// FORZAR_RATE_LIMIT_PRUEBA=true. Vive en la memoria del proceso; sin `trust proxy` configurado, detrás de un proxy la IP
// que ve Express es la del proxy (todos comparten cupo): depende del despliegue.
const limitarComprobacionGratis = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LIMITE_COMPROBAR_GRATIS_RATE) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, opciones) => {
    const reintentarEnSeg = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000));
    res.status(opciones.statusCode).json({
      error: 'Demasiadas comprobaciones, intenta más tarde',
      codigo: 'DEMASIADOS_INTENTOS',
      reintentar_en_seg: reintentarEnSeg,
    });
  },
  skip: () => process.env.NODE_ENV === 'test' && process.env.FORZAR_RATE_LIMIT_PRUEBA !== 'true',
});

router.post('/gratis/comprobar', limitarComprobacionGratis, comprobarAsesoriaGratis);

export default router;
