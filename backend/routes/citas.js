import { Router } from 'express';
import { crearCita, listarCitas, actualizarCita } from '../controllers/citasController.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();

router.post('/', crearCita);
router.get('/', verificarToken, listarCitas);
router.patch('/:id', verificarToken, actualizarCita);

export default router;
