// Configuración de la verificación del correo (código de 6 dígitos). Se lee de process.env en cada llamada.
// La verificación es SIEMPRE obligatoria: no existe ninguna variable que la desactive (REQUIRE_EMAIL_VERIFICATION se
// eliminó y, si alguien la deja en su .env, se ignora). En producción es obligatorio además que el correo esté
// habilitado con un SMTP válido. EMAIL_VERIF_SECRET debe ser propio (≥ 32 caracteres, distinto de JWT_SECRET).
// Los mensajes de error nunca incluyen valores.
import { leerConfigCorreo } from './correo.js';
import { LARGO_MIN_SECRETO, problemasDeSecreto } from './secretos.js';

export { LARGO_MIN_SECRETO };
export const enProduccion = (variables = process.env) => variables.NODE_ENV === 'production';

export const leerSecretoVerificacion = (variables = process.env) => String(variables.EMAIL_VERIF_SECRET ?? '');

// Lanza un Error claro si la configuración no sirve.
export const validarConfiguracionVerificacion = (variables = process.env) => {
  const problemas = [];
  const secreto = leerSecretoVerificacion(variables);
  problemas.push(...problemasDeSecreto('EMAIL_VERIF_SECRET', secreto));
  if (secreto && secreto === variables.JWT_SECRET) problemas.push('EMAIL_VERIF_SECRET debe ser distinto de JWT_SECRET');
  if (enProduccion(variables)) {
    const correo = (() => {
      try {
        return leerConfigCorreo(variables);
      } catch (err) {
        problemas.push(err.message);
        return null;
      }
    })();
    if (correo && !correo.habilitado) problemas.push('EMAIL_ENABLED debe ser true en producción (con un SMTP válido)');
  }
  if (problemas.length > 0) throw new Error(`Configuración de verificación de correo inválida: ${problemas.join('; ')}`);
};
