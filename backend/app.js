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
import { errorHandler } from './middlewares/errorHandler.js';

export const crearApp = () => {
  const app = express();

  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());

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

  app.use(errorHandler);

  return app;
};
