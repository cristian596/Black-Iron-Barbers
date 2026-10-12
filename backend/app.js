import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import barberoRoutes from './routes/barbero.js';
import perfilRoutes from './routes/perfil.js';
import barberosRoutes from './routes/barberos.js';
import serviciosRoutes from './routes/servicios.js';
import categoriasRoutes from './routes/categorias.js';
import disponibilidadRoutes from './routes/disponibilidad.js';
import citasRoutes from './routes/citas.js';
import asesoriasRoutes from './routes/asesorias.js';
import verificacionCorreoRoutes from './routes/verificacionCorreo.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { cabecerasSeguridad } from './middlewares/cabecerasSeguridad.js';

export const crearApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(cabecerasSeguridad);
  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json({ limit: '100kb' }));
  // Con un Content-Type distinto de JSON (form-urlencoded, texto, sin cuerpo) Express 5 deja req.body sin definir y los
  // controladores que lo desestructuran fallaban con un TypeError (500). Un objeto vacío los lleva a su validación normal (400).
  // La subida de fotos usa su propio parser (express.raw) en esa ruta y lo reemplaza.
  app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

  app.get('/', (req, res) => {
    res.send('Servidor de Black Iron Barbers corriendo con éxito 💈');
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/barbero', barberoRoutes);
  app.use('/api/perfil', perfilRoutes);
  app.use('/api/barberos', barberosRoutes);
  app.use('/api/servicios', serviciosRoutes);
  app.use('/api/categorias', categoriasRoutes);
  app.use('/api/disponibilidad', disponibilidadRoutes);
  app.use('/api/citas', citasRoutes);
  app.use('/api/asesorias', asesoriasRoutes);
  app.use('/api/verificacion-correo', verificacionCorreoRoutes);

  // Cualquier otra ruta: JSON genérico (el 404 por defecto de Express es HTML y nombra el framework).
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  app.use(errorHandler);

  return app;
};
