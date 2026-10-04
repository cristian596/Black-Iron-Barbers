import { Router } from 'express';
import { listarServicios, obtenerServicio } from '../controllers/serviciosController.js';

const router = Router();

router.get('/', listarServicios);
router.get('/:id', obtenerServicio);

export default router;
