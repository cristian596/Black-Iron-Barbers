import { env } from './config/env.js';
import { crearApp } from './app.js';
import { conectarConReintentos, pool } from './db/connection.js';
import { leerConfigCorreo } from './config/correo.js';
import { leerConfigRecordatorios } from './config/recordatorios.js';
import { validarConfiguracionVerificacion } from './config/verificacion.js';
import { iniciarPlanificadorRecordatorios } from './utils/recordatorios.js';
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

  // Recordatorios: con RECORDATORIOS_ENABLED=true valida los valores (error claro si alguno es inválido).
  const recordatorios = leerConfigRecordatorios();

  await conectarConReintentos();

  const app = crearApp();
  const servidor = app.listen(env.port, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${env.port}`);
  });

  // El temporizador solo corre con RECORDATORIOS_ENABLED=true Y EMAIL_ENABLED=true.
  let planificador = null;
  if (recordatorios.activo) {
    planificador = iniciarPlanificadorRecordatorios({
      intervaloMin: recordatorios.intervaloMin,
      horasAntes: recordatorios.horasAntes,
      maxPorCiclo: recordatorios.maxPorCiclo,
    });
    console.log(`⏰ Recordatorios activos (${recordatorios.horasAntes} h antes, cada ${recordatorios.intervaloMin} min, máx. ${recordatorios.maxPorCiclo} por ciclo)`);
  } else if (recordatorios.aviso) {
    console.warn(`⚠️ ${recordatorios.aviso}`);
  } else {
    console.log('⏰ Recordatorios deshabilitados (RECORDATORIOS_ENABLED=false)');
  }

  // Apagado ordenado: para el temporizador (espera al ciclo en curso), cierra el servidor y la base.
  let cerrando = false;
  const apagar = async (senal) => {
    if (cerrando) return;
    cerrando = true;
    console.log(`🛑 ${senal} recibida: cerrando…`);
    try {
      await planificador?.detener();
      await new Promise((resolver) => servidor.close(resolver));
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.error('❌ Error al cerrar:', err.message);
      process.exit(1);
    }
  };
  servidor.on('close', () => planificador?.detener());
  process.once('SIGTERM', () => apagar('SIGTERM'));
  process.once('SIGINT', () => apagar('SIGINT'));
};

iniciar().catch((err) => {
  console.error('❌ No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
