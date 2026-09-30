import express from 'express';
import cors from 'cors';

export const crearApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('Servidor de Black Iron Barbers corriendo con éxito 💈');
  });

  return app;
};
