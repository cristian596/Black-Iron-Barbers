// Configuración del correo saliente. Se lee de process.env en cada llamada (no al importar) para que las pruebas puedan
// activarlo o apagarlo. En producción las variables llegan por `environment:` de docker-compose.yml; nunca van al repo.
// EMAIL_ENABLED es false por defecto: sin él no se envía nada.

const VERDADERO = ['true', '1', 'yes', 'si', 'sí'];
const leerBooleano = (valor) => VERDADERO.includes(String(valor ?? '').trim().toLowerCase());

export const correoHabilitado = (variables = process.env) => leerBooleano(variables.EMAIL_ENABLED);

// Quita saltos de línea y caracteres de control: el remitente va a una cabecera.
const limpiarCabecera = (valor) => String(valor ?? '').replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim();

// Devuelve la configuración. Con EMAIL_ENABLED=true valida los datos obligatorios y lanza un Error claro si faltan;
// con EMAIL_ENABLED=false no valida nada. El Error nunca incluye valores (menos aún SMTP_PASS).
export const leerConfigCorreo = (variables = process.env) => {
  if (!correoHabilitado(variables)) return { habilitado: false };

  const faltantes = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM'].filter((clave) => !String(variables[clave] ?? '').trim());
  const puerto = Number(variables.SMTP_PORT);
  const problemas = [];
  if (faltantes.length > 0) problemas.push(`faltan ${faltantes.join(', ')}`);
  if (variables.SMTP_PORT && (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535)) {
    problemas.push('SMTP_PORT debe ser un puerto válido (1-65535)');
  }
  const usuario = String(variables.SMTP_USER ?? '');
  const clave = String(variables.SMTP_PASS ?? '');
  if (Boolean(usuario) !== Boolean(clave)) problemas.push('SMTP_USER y SMTP_PASS deben definirse juntos');
  if (problemas.length > 0) {
    throw new Error(`Configuración de correo inválida (EMAIL_ENABLED=true): ${problemas.join('; ')}`);
  }

  return {
    habilitado: true,
    smtp: {
      host: String(variables.SMTP_HOST).trim(),
      port: puerto,
      secure: leerBooleano(variables.SMTP_SECURE),
      ...(usuario ? { auth: { user: usuario, pass: clave } } : {}),
    },
    from: limpiarCabecera(variables.EMAIL_FROM),
  };
};
