import { Router } from 'express';
import { verificarToken } from '../middlewares/verificarToken.js';
import { requiereRol } from '../middlewares/requiereRol.js';

const router = Router();

// Ruta temporal para verificar el middleware de roles.
// Los endpoints reales de administración se agregan en la Sesión 3.
router.get('/ping', verificarToken, requiereRol('admin'), (req, res) => {
  res.json({ mensaje: 'Acceso de administrador confirmado' });
});

export default router;
