import { Router } from 'express';
import { verificarToken } from '../middlewares/verificarToken.js';
import { requiereRol } from '../middlewares/requiereRol.js';
import { listarUsuarios, obtenerResumen, crearUsuario, actualizarUsuario } from '../controllers/adminController.js';

const router = Router();

router.use(verificarToken, requiereRol('admin'));

router.get('/resumen', obtenerResumen);
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', crearUsuario);
router.patch('/usuarios/:id', actualizarUsuario);

export default router;
