// Validador ÚNICO de correo (solicitar código, confirmar código y POST /api/citas). Devuelve el correo normalizado
// (recorte + minúsculas) o null. Es estricto a propósito: una sola dirección simple, sin nada que pueda colarse en una
// cabecera o en una lista de destinatarios ("a@b.com,c.d", "x@y.com>", "a b@c.com", saltos de línea…).
//  - texto de 3 a 254 caracteres; exactamente un @;
//  - parte local de 1 a 64: letras, dígitos y . ! # $ % & * + / = ? ^ _ { | } ~ -  (sin comillas, comas, ; < > ni
//    espacios); sin punto al inicio, al final ni dos seguidos;
//  - dominio con al menos un punto; etiquetas de 1 a 63 con letras, dígitos y guion (sin guion en los extremos);
//    la última (TLD) solo letras (2 o más) o punycode (xn--).
export const LARGO_MAX_CORREO = 254;
const LARGO_MAX_LOCAL = 64;

const REGEX_LOCAL = /^[a-z0-9!#$%&*+/=?^_{|}~-]+(?:\.[a-z0-9!#$%&*+/=?^_{|}~-]+)*$/;
const REGEX_ETIQUETA = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const REGEX_TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export const normalizarCorreoExacto = (valor) => (typeof valor === 'string' ? valor.trim().toLowerCase() : '');

export const validarCorreo = (valor) => {
  const correo = normalizarCorreoExacto(valor);
  if (correo.length < 3 || correo.length > LARGO_MAX_CORREO) return null;
  const partes = correo.split('@');
  if (partes.length !== 2) return null;
  const [local, dominio] = partes;
  if (local.length === 0 || local.length > LARGO_MAX_LOCAL || !REGEX_LOCAL.test(local)) return null;
  const etiquetas = dominio.split('.');
  if (etiquetas.length < 2) return null;
  if (!etiquetas.every((etiqueta) => REGEX_ETIQUETA.test(etiqueta) || REGEX_TLD.test(etiqueta))) return null;
  if (!REGEX_TLD.test(etiquetas[etiquetas.length - 1])) return null;
  return correo;
};
