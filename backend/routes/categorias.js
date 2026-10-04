import { Router } from 'express';
import { listarCategorias } from '../controllers/categoriasController.js';

const router = Router();

router.get('/', listarCategorias);

export default router;
