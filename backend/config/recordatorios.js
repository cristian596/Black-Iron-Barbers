// Configuración de los recordatorios por correo. Se lee de process.env en cada llamada (las pruebas la cambian).
// RECORDATORIOS_ENABLED es false por defecto. Solo corre el temporizador con RECORDATORIOS_ENABLED=true Y EMAIL_ENABLED=true.
// Los valores se validan solo con RECORDATORIOS_ENABLED=true; un valor inválido lanza un Error claro (sin imprimir valores).
import { correoHabilitado } from './correo.js';

const VERDADERO = ['true', '1', 'yes', 'si', 'sí'];
const leerBooleano = (valor) => VERDADERO.includes(String(valor ?? '').trim().toLowerCase());

export const HORAS_ANTES_POR_DEFECTO = 24;
export const INTERVALO_MIN_POR_DEFECTO = 5;
export const MAX_POR_CICLO_POR_DEFECTO = 50;
// Tope de intentos fallidos por cita y vida de un reclamo (un ciclo que murió a medias no bloquea la cita para siempre).
export const MAX_INTENTOS = 3;
export const MINUTOS_RECLAMO_VIGENTE = 10;
// No se recuerda lo inminente: el inicio debe estar a más de esto.
export const MINUTOS_MINIMOS_ANTES = 60;

const entero = (variables, clave, porDefecto, min, max, problemas) => {
  const crudo = String(variables[clave] ?? '').trim();
  if (crudo === '') return porDefecto;
  const valor = Number(crudo);
  if (!/^\d+$/.test(crudo) || !Number.isInteger(valor) || valor < min || valor > max) {
    problemas.push(`${clave} debe ser un entero entre ${min} y ${max}`);
    return porDefecto;
  }
  return valor;
};

// Devuelve { habilitado, activo, horasAntes, intervaloMin, maxPorCiclo, aviso }.
//  - habilitado: RECORDATORIOS_ENABLED=true.
//  - activo: habilitado Y EMAIL_ENABLED=true (lo único que arranca el planificador).
//  - aviso: texto cuando se pidieron recordatorios pero el correo está apagado (no es un error fatal).
export const leerConfigRecordatorios = (variables = process.env) => {
  if (!leerBooleano(variables.RECORDATORIOS_ENABLED)) return { habilitado: false, activo: false };

  const problemas = [];
  const horasAntes = entero(variables, 'RECORDATORIO_HORAS_ANTES', HORAS_ANTES_POR_DEFECTO, 1, 72, problemas);
  const intervaloMin = entero(variables, 'RECORDATORIO_INTERVALO_MIN', INTERVALO_MIN_POR_DEFECTO, 1, 60, problemas);
  const maxPorCiclo = entero(variables, 'RECORDATORIO_MAX_POR_CICLO', MAX_POR_CICLO_POR_DEFECTO, 1, 1000, problemas);
  if (problemas.length > 0) {
    throw new Error(`Configuración de recordatorios inválida (RECORDATORIOS_ENABLED=true): ${problemas.join('; ')}`);
  }

  const activo = correoHabilitado(variables);
  return {
    habilitado: true,
    activo,
    horasAntes,
    intervaloMin,
    maxPorCiclo,
    aviso: activo ? null : 'RECORDATORIOS_ENABLED=true pero EMAIL_ENABLED no es true: los recordatorios NO se enviarán.',
  };
};
