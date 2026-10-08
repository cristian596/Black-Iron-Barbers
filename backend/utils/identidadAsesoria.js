// Identidad de una persona para el límite "una asesoría gratis por persona": el correo y el teléfono se reducen a una
// forma canónica (correo_norm / telefono_norm de asesoria_gratis_usos) para que las variantes triviales de lo mismo
// choquen en las UNIQUE. Un solo módulo: lo usan la reserva (POST /api/citas) y la comprobación temprana.
import { normalizarTelefono, esTelefonoValido } from './telefono.js';

const DOMINIOS_GMAIL = new Set(['gmail.com', 'googlemail.com']);

// Correo canónico:
//  - recorte y minúsculas;
//  - sufijo +etiqueta de la parte local fuera, en TODOS los dominios (a+x@d.com → a@d.com);
//  - puntos de la parte local fuera SOLO en Gmail (googlemail.com se trata como gmail.com); en los demás dominios
//    los puntos distinguen buzones y se conservan.
// Si lo que queda de la parte local estaría vacío (p. ej. "+x@d.com") se conserva la original, para no fundir en un
// mismo buzón direcciones que no tienen nada en común. Devuelve '' si no es un correo con forma usuario@dominio.
export const normalizarCorreo = (valor) => {
  if (typeof valor !== 'string') return '';
  const correo = valor.trim().toLowerCase();
  const arroba = correo.lastIndexOf('@');
  if (arroba <= 0 || arroba === correo.length - 1) return '';

  let local = correo.slice(0, arroba);
  let dominio = correo.slice(arroba + 1);
  if (dominio === 'googlemail.com') dominio = 'gmail.com';

  const sinEtiqueta = local.split('+')[0];
  if (sinEtiqueta.length > 0) local = sinEtiqueta;
  if (DOMINIOS_GMAIL.has(dominio)) {
    const sinPuntos = local.replaceAll('.', '');
    if (sinPuntos.length > 0) local = sinPuntos;
  }
  return `${local}@${dominio}`;
};

// { correo_norm, telefono_norm } o null si el correo o el teléfono no son válidos. El teléfono es el celular de 10
// dígitos de utils/telefono.js (acepta +57, espacios y guiones).
export const identidadAsesoria = (correo, telefono) => {
  const correoNorm = normalizarCorreo(correo);
  const telefonoNorm = normalizarTelefono(telefono);
  if (!correoNorm || !esTelefonoValido(telefonoNorm)) return null;
  return { correo_norm: correoNorm, telefono_norm: telefonoNorm };
};
