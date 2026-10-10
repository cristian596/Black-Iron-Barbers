import { env } from './config/env.js';
import { crearApp } from './app.js';
import { conectarConReintentos } from './db/connection.js';
import { leerConfigCorreo } from './config/correo.js';

const iniciar = async () => {
  // Con EMAIL_ENABLED=true valida la configuración SMTP al arrancar (error claro si falta algo); si no, no hace nada.
  const correo = leerConfigCorreo();
  console.log(correo.habilitado ? `📧 Correo habilitado (SMTP ${correo.smtp.host}:${correo.smtp.port})` : '📧 Correo deshabilitado (EMAIL_ENABLED=false)');

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
