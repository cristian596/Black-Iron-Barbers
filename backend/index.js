import { env } from './config/env.js';
import { crearApp } from './app.js';
import { conectarConReintentos } from './db/connection.js';

const iniciar = async () => {
  await conectarConReintentos();

  const app = crearApp();
  app.listen(env.port, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${env.port}`);
  });
};

iniciar().catch((err) => {
  console.error('❌ No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
