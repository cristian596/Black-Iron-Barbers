// Mismo criterio que el validador del back-end (backend/utils/validarCorreo.js): una sola dirección simple, sin espacios,
// comas, punto y coma, ángulos ni comillas. El servidor decide; esto solo evita viajes inútiles.
// "Normalizar" = recortar y pasar a minúsculas: así se compara el correo escrito con el que se verificó.

const LARGO_MAX = 254
const LARGO_MAX_LOCAL = 64
const REGEX_LOCAL = /^[a-z0-9!#$%&*+/=?^_{|}~-]+(?:\.[a-z0-9!#$%&*+/=?^_{|}~-]+)*$/
const REGEX_ETIQUETA = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const REGEX_TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/

export const normalizarCorreo = (correo) => (typeof correo === 'string' ? correo.trim().toLowerCase() : '')

export const esCorreoValido = (correo) => {
  const texto = normalizarCorreo(correo)
  if (texto.length < 3 || texto.length > LARGO_MAX) return false
  const partes = texto.split('@')
  if (partes.length !== 2) return false
  const [local, dominio] = partes
  if (local.length === 0 || local.length > LARGO_MAX_LOCAL || !REGEX_LOCAL.test(local)) return false
  const etiquetas = dominio.split('.')
  if (etiquetas.length < 2) return false
  if (!etiquetas.every((etiqueta) => REGEX_ETIQUETA.test(etiqueta) || REGEX_TLD.test(etiqueta))) return false
  return REGEX_TLD.test(etiquetas[etiquetas.length - 1])
}
