import { Router } from 'express';
import { verificarToken } from '../middlewares/verificarToken.js';
import { requiereRol } from '../middlewares/requiereRol.js';
import { obtenerMisEstadisticas, obtenerMisIngresos, obtenerMisServiciosTop } from '../controllers/estadisticasController.js';
import { resumenDelDia, citasPorConfirmar, agendaHoy, listarMisCitas } from '../controllers/barberoController.js';

const router = Router();

// Solo lectura y solo barberos (el admin tiene /api/admin). Con la contraseña caducada verificarToken ya responde 403.
router.use(verificarToken, requiereRol('barbero'));

router.get('/resumen', resumenDelDia);
router.get('/citas-por-confirmar', citasPorConfirmar);
router.get('/agenda-hoy', agendaHoy);
router.get('/citas', listarMisCitas);
router.get('/estadisticas', obtenerMisEstadisticas);
router.get('/estadisticas/ingresos', obtenerMisIngresos);
router.get('/estadisticas/servicios-top', obtenerMisServiciosTop);

export default router;
