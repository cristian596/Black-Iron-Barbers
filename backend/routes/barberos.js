import { Router } from 'express';
import { listarBarberos } from '../controllers/barberosController.js';

const router = Router();

router.get('/', listarBarberos);

export default router;
