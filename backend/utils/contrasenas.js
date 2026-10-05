// Reglas de caducidad de contraseñas de los barberos (el admin está exento). Todo el cálculo se hace en Node con
// fechas de calendario de Bogotá, nunca con NOW()/CURRENT_DATE de Postgres.
import { fechaBogota } from './fechas.js';
import { sumarDias } from './periodos.js';

export const VIGENCIA_DIAS = 60; // días de vida de una contraseña desde su último cambio
export const AVISO_DIAS = 2; // se avisa cuando faltan 2 días o menos
export const MIN_CONTRASENA = 8;
export const MAX_CONTRASENA = 72; // bcrypt solo lee los primeros 72 bytes

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const aDiaUTC = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
};

// `cambiadaEn`: instante del último cambio (Date o texto ISO). `ahora` se inyecta solo en pruebas.
//
// dias_restantes = días de CALENDARIO entre hoy y vence_en, ambos en Bogotá, donde
// vence_en = (fecha Bogotá del cambio) + 60 días. Se cuenta por fecha y no por bloques de 24 h para que el número
// no cambie según la hora a la que se cambió la contraseña, no dependa de la zona del servidor (a las 22:00 de
// Bogotá ya es "mañana" en UTC) y cuadre con un "caduca en N días" que el barbero entiende.
//   · vence_en es el primer día en que la contraseña YA no sirve (día 60 contando el del cambio como día 0).
//   · dias_restantes >= 3 → vigente · 1 o 2 → por_vencer · 0 o menos → caducada.
export const estadoContrasena = (cambiadaEn, ahora = new Date()) => {
  const venceEn = sumarDias(fechaBogota(new Date(cambiadaEn)), VIGENCIA_DIAS);
  const diasRestantes = Math.round((aDiaUTC(venceEn) - aDiaUTC(fechaBogota(ahora))) / MS_POR_DIA);
  let estado = 'vigente';
  if (diasRestantes <= 0) estado = 'caducada';
  else if (diasRestantes <= AVISO_DIAS) estado = 'por_vencer';
  return { estado, dias_restantes: diasRestantes, vence_en: venceEn };
};

export const longitudContrasenaValida = (valor) =>
  typeof valor === 'string' && valor.length >= MIN_CONTRASENA && valor.length <= MAX_CONTRASENA;
