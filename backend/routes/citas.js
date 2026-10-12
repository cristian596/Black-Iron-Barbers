import { Router } from 'express';
import { omitirLimitadores } from '../config/entorno.js';
import rateLimit from 'express-rate-limit';
import { crearCita, listarCitas, actualizarCita } from '../controllers/citasController.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();

const limitarCreacionCitas = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Configurable para que la suite de pruebas pueda forzar un límite bajo y verificar el 429 real.
  limit: Number(process.env.LIMITE_CITAS_RATE) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de reserva, intenta más tarde' },
  // Evita que el resto de la suite de Vitest (muchos POST seguidos sobre la misma app)
  // choque con el límite; FORZAR_RATE_LIMIT_PRUEBA=true lo reactiva para probarlo en sí mismo.
  skip: () => omitirLimitadores(),
});

router.post('/', limitarCreacionCitas, crearCita);
router.get('/', verificarToken, listarCitas);
router.patch('/:id', verificarToken, actualizarCita);

export default router;
