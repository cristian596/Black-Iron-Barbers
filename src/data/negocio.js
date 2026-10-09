import { rutaAsesoria } from './asesorias'

// Datos del negocio: única fuente para el inicio.
export const negocio = {
  ciudad: 'Facatativá',
  direccion: 'Cll 22 #1 A 69 sur, Prado Cartagenita',
  horario: 'Todos los días y festivos · 9 a. m. – 6 p. m.',
}

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

export const enlaceWhatsApp = (mensaje) => `https://wa.me/${numeroWhatsApp()}?text=${encodeURIComponent(mensaje)}`

// Destino del botón de asesoría gratuita (Home → "Reserva a tu manera"): la misma ancla que usa el modal
// de "Soy cliente nuevo" (página /asesorias).
export const RUTA_ASESORIA = rutaAsesoria('gratis')
