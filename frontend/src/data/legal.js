import { NOMBRE_NEGOCIO, contacto, negocio } from './negocio'

// Configuración legal: ÚNICA fuente de los datos que aparecen en las políticas (privacidad, tratamiento de datos y
// cookies). Las páginas muestran cada campo solo si tiene valor.
// Datos ficticios de portafolio: `razonSocial` y `nit` quedan vacíos hasta que existan los reales (no inventarlos);
// `telefono` también (el negocio no publica uno; el WhatsApp real va por VITE_WHATSAPP_NUMERO y no se imprime aquí).
export const LEGAL = {
  nombreComercial: NOMBRE_NEGOCIO,
  razonSocial: '',
  nit: '',
  domicilio: `${contacto.direccion}, ${negocio.ciudad}`,
  correo: contacto.correo,
  telefono: '',
  // Fecha (AAAA-MM-DD) y versión de las políticas. Al cambiar la versión se vuelve a pedir el consentimiento de cookies.
  actualizadoEn: '2026-10-26',
  version: '1.0',
}

export const RUTAS_LEGALES = {
  privacidad: '/politica-de-privacidad',
  datos: '/tratamiento-de-datos',
  cookies: '/politica-de-cookies',
}

export const NOMBRES_LEGALES = {
  privacidad: 'Política de Privacidad',
  datos: 'Política de Tratamiento de Datos Personales',
  cookies: 'Política de Cookies',
}
