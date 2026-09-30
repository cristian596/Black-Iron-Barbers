import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
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

  app.use(errorHandler);

  return app;
};
