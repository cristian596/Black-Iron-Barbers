import { rutaAsesoria } from './asesorias'

// Horario de atención: ÚNICA fuente del front (Hero y Footer derivan su texto de aquí). El backend tiene la suya en
// backend/config/horario.js; el test horarioCoherencia.test.js falla si `apertura`/`cierre` difieren.
export const HORARIO_ATENCION = {
  dias: 'Lunes a domingo',
  apertura: '10:00',
  cierre: '20:00',
  texto: '10:00 a. m. – 8:00 p. m.',
}

// Dirección del local: única fuente (Hero y Footer).
export const DIRECCION_NEGOCIO = 'Calle 22 #1 A 69 sur, Prado Cartagenita'

// Datos del negocio: única fuente para el inicio.
export const negocio = {
  ciudad: 'Facatativá',
  direccion: DIRECCION_NEGOCIO,
  horario: `Todos los días y festivos · ${HORARIO_ATENCION.texto}`,
}

// Datos del pie de página (única fuente para el footer público).
export const NOMBRE_NEGOCIO = 'Black Iron Barbers'

export const contacto = {
  direccion: DIRECCION_NEGOCIO,
  correo: 'blackIronBarbers@corre.com',
}

export const enlaceMapa = (direccion) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`

// Redes sociales: valores PROVISIONALES. '#' = aún sin URL real (el footer no navega ni abre pestaña).
export const URL_FACEBOOK = '#'
export const URL_INSTAGRAM = '#'
export const URL_TIKTOK = '#'

export const REDES_SOCIALES = [
  { id: 'facebook', nombre: 'Facebook', url: URL_FACEBOOK },
  { id: 'instagram', nombre: 'Instagram', url: URL_INSTAGRAM },
  { id: 'tiktok', nombre: 'TikTok', url: URL_TIKTOK },
]

// Cifras de la sección de estadísticas (datos ficticios de portafolio).
// La cifra de barberos no tiene valor fijo: viene de la API (desdeApi) para
// coincidir siempre con el hero.
export const ESTADISTICAS = [
  { id: 'clientes', etiqueta: 'Clientes', valor: 6, prefijo: '+', sufijo: 'K' },
  { id: 'barberos', etiqueta: 'Barberos', desdeApi: true },
  { id: 'anios', etiqueta: 'Años', valor: 6 },
  { id: 'locales', etiqueta: 'Locales', valor: 2 },
]

// WhatsApp. El repo es público: el número NO va en el código, sale de la variable de entorno de Vite
// VITE_WHATSAPP_NUMERO (solo dígitos con indicativo de país, p. ej. 57 + número; ver .env.example). Si falta,
// se usa el placeholder y el enlace no llevará a ningún chat. Se lee al llamar, no al cargar el módulo.
export const WHATSAPP_PLACEHOLDER = 'PENDIENTE_NUMERO'

export const numeroWhatsApp = () => {
  const limpio = String(import.meta.env.VITE_WHATSAPP_NUMERO ?? '').replace(/\D/g, '')
  return limpio || WHATSAPP_PLACEHOLDER
}

export const MENSAJE_WHATSAPP_GENERAL = '¡Hola! Quiero agendar una cita en Black Iron Barbers.'

// true solo si hay un número real configurado (no el placeholder).
export const hayWhatsAppReal = () => numeroWhatsApp() !== WHATSAPP_PLACEHOLDER

export const enlaceWhatsApp = (mensaje) => `https://wa.me/${numeroWhatsApp()}?text=${encodeURIComponent(mensaje)}`

// Destino del botón de asesoría gratuita (Home → "Reserva a tu manera"): la misma ancla que usa el modal
// de "Soy cliente nuevo" (página /asesorias).
export const RUTA_ASESORIA = rutaAsesoria('gratis')
