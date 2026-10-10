// Validación de los secretos de firma (JWT_SECRET y EMAIL_VERIF_SECRET). Los mensajes nunca incluyen valores.
// Un secreto aceptable: ≥ 32 caracteres, con variedad real (no "aaaa…" ni "12341234…"), que no sea un valor de ejemplo
// conocido ni uno publicado alguna vez en el repositorio (se compara por hash SHA-256: el valor no se guarda aquí).
import { createHash } from 'node:crypto';
import { esEntornoDePruebas } from './entorno.js';

export const LARGO_MIN_SECRETO = 32;
const CARACTERES_UNICOS_MIN = 10;
const ENTROPIA_MIN_BITS_POR_CARACTER = 3;

const PREFIJOS_DE_EJEMPLO = ['cambia-esto', 'changeme', 'change-me', 'secret', 'password', 'tu-secreto', 'your-secret', 'example', 'ejemplo'];

// Secretos que estuvieron versionados en .env.example (repositorio público) y por tanto están comprometidos.
const HASHES_COMPROMETIDOS = new Set(['8cb122c25b88751199b894cf22c5aae7a263d8df83c0cf8ec2fdba2a662f2e7e']);

export const sha256 = (texto) => createHash('sha256').update(texto).digest('hex');

export const entropiaPorCaracter = (texto) => {
  const total = texto.length;
  if (total === 0) return 0;
  const cuentas = new Map();
  for (const c of texto) cuentas.set(c, (cuentas.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of cuentas.values()) h -= (n / total) * Math.log2(n / total);
  return h;
};

// Devuelve la lista de problemas (texto sin valores) de un secreto.
export const problemasDeSecreto = (nombre, valor) => {
  const secreto = String(valor ?? '');
  if (!secreto) return [`falta ${nombre}`];
  const problemas = [];
  if (secreto.length < LARGO_MIN_SECRETO) problemas.push(`${nombre} es demasiado corto (mínimo ${LARGO_MIN_SECRETO} caracteres)`);
  const minusculas = secreto.toLowerCase();
  if (PREFIJOS_DE_EJEMPLO.some((p) => minusculas.startsWith(p))) problemas.push(`${nombre} sigue siendo un valor de ejemplo`);
  if (HASHES_COMPROMETIDOS.has(sha256(secreto))) problemas.push(`${nombre} es un valor que estuvo publicado en el repositorio: genera uno nuevo`);
  if (new Set(secreto).size < CARACTERES_UNICOS_MIN || entropiaPorCaracter(secreto) < ENTROPIA_MIN_BITS_POR_CARACTER) {
    problemas.push(`${nombre} es demasiado predecible (poca variedad de caracteres)`);
  }
  return problemas;
};

export const esEntornoDePrueba = esEntornoDePruebas;

// JWT_SECRET: exige fuerza en todo entorno salvo test. (EMAIL_VERIF_SECRET se valida en config/verificacion.js.)
export const validarSecretoJwt = (variables = process.env) => {
  if (esEntornoDePrueba(variables)) return;
  const problemas = problemasDeSecreto('JWT_SECRET', variables.JWT_SECRET);
  if (problemas.length > 0) throw new Error(`Configuración de seguridad inválida: ${problemas.join('; ')}`);
};

// FRONTEND_URL es el ÚNICO origen que CORS acepta. Un comodín o un valor que no sea un origen (esquema + host, sin ruta)
// dejaría CORS abierto o inútil; en producción además debe ser https. Fuera de producción se admite http (localhost).
export const validarOrigenFrontend = (variables = process.env) => {
  if (esEntornoDePruebas(variables)) return;
  const valor = String(variables.FRONTEND_URL ?? '');
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('Configuración de seguridad inválida: FRONTEND_URL debe ser un origen válido (p. ej. https://midominio.com)');
  }
  const esOrigen = (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === valor && !valor.includes('*');
  if (!esOrigen) throw new Error('Configuración de seguridad inválida: FRONTEND_URL debe ser solo un origen (esquema + dominio, sin ruta ni barra final ni comodines)');
  if (variables.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('Configuración de seguridad inválida: en producción FRONTEND_URL debe usar https');
  }
};
