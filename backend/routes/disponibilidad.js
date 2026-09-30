import { Router } from 'express';
import { obtenerDisponibilidad } from '../controllers/disponibilidadController.js';

const router = Router();

router.get('/', obtenerDisponibilidad);

export default router;
