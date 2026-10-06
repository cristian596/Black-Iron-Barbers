import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verificarToken } from '../middlewares/verificarToken.js';
import { obtenerPerfil, actualizarPerfil, leerFoto, subirFoto, quitarFoto, servirFoto } from '../controllers/perfilController.js';

const router = Router();

// Subir fotos escribe en disco: 10 por usuario cada 15 min (por usuario, no por IP; va después de verificarToken).
// En pruebas se omite salvo FORZAR_RATE_LIMIT_PRUEBA=true (igual que el resto de limitadores).
const limitarSubidaFoto = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `usuario-${req.usuario.id}`,
  message: { error: 'Demasiadas subidas de foto, intenta más tarde', codigo: 'DEMASIADOS_INTENTOS' },
  skip: () => process.env.NODE_ENV === 'test' && process.env.FORZAR_RATE_LIMIT_PRUEBA !== 'true',
});

// Pública a propósito (un <img> no manda Authorization): el nombre es un UUID y se valida con lista blanca.
router.get('/foto/:archivo', servirFoto);

// Todo lo demás exige sesión; con la contraseña caducada responde 403 CONTRASENA_CADUCADA como el resto de la API.
router.use(verificarToken);
router.get('/', obtenerPerfil);
router.patch('/', actualizarPerfil);
router.post('/foto', limitarSubidaFoto, leerFoto, subirFoto);
router.delete('/foto', quitarFoto);

export default router;
