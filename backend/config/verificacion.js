// Configuración de la verificación del correo (código de 6 dígitos). Se lee de process.env en cada llamada.
// REQUIRE_EMAIL_VERIFICATION es true por defecto. En producción es obligatorio que sea true, que el correo esté
// habilitado con un SMTP válido y que EMAIL_VERIF_SECRET sea propio (≥ 32 caracteres, distinto de JWT_SECRET).
// Los mensajes de error nunca incluyen valores.
import { leerConfigCorreo } from './correo.js';

export const LARGO_MIN_SECRETO = 32;
const PREFIJO_EJEMPLO = 'cambia-esto'; // el placeholder de .env.example
const FALSO = ['false', '0', 'no'];

export const verificacionRequerida = (variables = process.env) => {
  const valor = String(variables.REQUIRE_EMAIL_VERIFICATION ?? '').trim().toLowerCase();
  return valor === '' ? true : !FALSO.includes(valor);
};

export const enProduccion = (variables = process.env) => variables.NODE_ENV === 'production';

export const leerSecretoVerificacion = (variables = process.env) => String(variables.EMAIL_VERIF_SECRET ?? '');

// Lanza un Error claro si la configuración no sirve. Con la verificación desactivada (solo fuera de producción) no
// exige nada.
export const validarConfiguracionVerificacion = (variables = process.env) => {
  const problemas = [];
  if (enProduccion(variables) && !verificacionRequerida(variables)) {
    problemas.push('REQUIRE_EMAIL_VERIFICATION debe ser true en producción');
  }
  if (verificacionRequerida(variables)) {
    const secreto = leerSecretoVerificacion(variables);
    if (!secreto) problemas.push('falta EMAIL_VERIF_SECRET');
    else if (secreto.length < LARGO_MIN_SECRETO) problemas.push(`EMAIL_VERIF_SECRET es demasiado corto (mínimo ${LARGO_MIN_SECRETO} caracteres)`);
    else if (secreto.startsWith(PREFIJO_EJEMPLO)) problemas.push('EMAIL_VERIF_SECRET sigue siendo el valor de ejemplo de .env.example');
    else if (secreto === variables.JWT_SECRET) problemas.push('EMAIL_VERIF_SECRET debe ser distinto de JWT_SECRET');
  }
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
