import { rutaAsesoria } from './asesorias'

// Datos del negocio: única fuente para el inicio.
export const negocio = {
  ciudad: 'Facatativá',
  direccion: 'Cll 22 #1 A 69 sur, Prado Cartagenita',
  horario: 'Todos los días y festivos · 9 a. m. – 6 p. m.',
}

// Datos del pie de página (única fuente para el footer público). OJO: `negocio.direccion` y `negocio.horario` de
// arriba son los del hero y todavía NO coinciden con estos; unificarlos es una decisión pendiente.
export const NOMBRE_NEGOCIO = 'Black Iron Barbers'

export const contacto = {
  direccion: 'Calle 22 #1-69 Facatativa',
  correo: 'blackIronBarbers@corre.com',
}

// Horario de atención del footer. `apertura` y `cierre` (HH:MM, 24 h) quedan como datos reutilizables para alinear
// la disponibilidad de la reserva; el backend (config/horario.js) sigue por ahora en 09:00–19:00.
export const HORARIO_ATENCION = {
  dias: 'Lunes a domingo',
  apertura: '10:00',
  cierre: '20:00',
  texto: '10:00 a. m. – 8:00 p. m.',
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
