import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, cambiarContrasena } from '../controllers/authController.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión, intenta más tarde' },
});

router.post('/login', limitarLogin, login);
router.patch('/contrasena', verificarToken, cambiarContrasena);

export default router;
