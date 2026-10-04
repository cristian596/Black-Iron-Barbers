import { Router } from 'express';
import { verificarToken } from '../middlewares/verificarToken.js';
import { requiereRol } from '../middlewares/requiereRol.js';
import { listarUsuarios, crearUsuario, actualizarUsuario } from '../controllers/adminController.js';
import { obtenerEstadisticas, obtenerIngresos, obtenerServiciosTop } from '../controllers/estadisticasController.js';
import { listarEmpleados, crearEmpleado, actualizarEmpleado } from '../controllers/adminEmpleadosController.js';
import { listarCitasAdmin } from '../controllers/adminCitasController.js';
import {
  listarServiciosAdmin,
  crearServicio,
  actualizarServicio,
  listarCategoriasAdmin,
  crearCategoria,
  actualizarCategoria,
} from '../controllers/adminCatalogoController.js';

const router = Router();

router.use(verificarToken, requiereRol('admin'));

router.get('/estadisticas', obtenerEstadisticas);
router.get('/estadisticas/ingresos', obtenerIngresos);
router.get('/estadisticas/servicios-top', obtenerServiciosTop);
router.get('/citas', listarCitasAdmin);
// Catálogo: sin DELETE a propósito (los servicios y categorías se desactivan para conservar el historial).
router.get('/servicios', listarServiciosAdmin);
router.post('/servicios', crearServicio);
router.patch('/servicios/:id', actualizarServicio);
router.get('/categorias', listarCategoriasAdmin);
router.post('/categorias', crearCategoria);
router.patch('/categorias/:id', actualizarCategoria);
// Empleados: sin DELETE a propósito (se desactivan, y con ellos su usuario, para conservar el historial de citas).
router.get('/empleados', listarEmpleados);
router.post('/empleados', crearEmpleado);
router.patch('/empleados/:id', actualizarEmpleado);
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', crearUsuario);
router.patch('/usuarios/:id', actualizarUsuario);

export default router;
