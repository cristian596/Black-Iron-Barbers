import { env } from './config/env.js';
import { crearApp } from './app.js';
import { conectarConReintentos } from './db/connection.js';
import { leerConfigCorreo } from './config/correo.js';
import { validarConfiguracionVerificacion } from './config/verificacion.js';
import { validarSecretoJwt, validarOrigenFrontend } from './config/secretos.js';

const iniciar = async () => {
  // Sin NODE_ENV el servidor se comporta como desarrollo (p. ej. sin las exigencias de producción): que no pase inadvertido.
  if (!process.env.NODE_ENV) {
    console.warn('⚠️  NODE_ENV no está definido: se trata como desarrollo. En un despliegue real DEBE ser NODE_ENV=production.');
  }
  // JWT_SECRET firma las sesiones: con longitud/variedad insuficiente o un valor de ejemplo el servidor no arranca.
  validarSecretoJwt();
  // CORS solo acepta FRONTEND_URL: que sea un origen real (https en producción) y no un comodín.
  validarOrigenFrontend();
  // La verificación del correo es obligatoria al reservar: sin un secreto propio (y, en producción, sin SMTP) no se arranca.
  validarConfiguracionVerificacion();

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
