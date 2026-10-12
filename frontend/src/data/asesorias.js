import { FaCrown, FaWandMagicSparkles } from 'react-icons/fa6'
import { GiBeard } from 'react-icons/gi'

// Asesorías de imagen (datos ficticios de portafolio): SOLO TEXTOS (descripciones, beneficios, pasos, etiquetas) para
// el modal de "Soy cliente nuevo" y la página /asesorias. El precio, la duración y el id de cada asesoría salen de la
// API (GET /api/servicios?area=asesoria): aquí no se repiten.
// Cada texto se une con su servicio por `clave`, el identificador estable público de los servicios del catálogo
// (`clave` en /api/servicios, = clave_seed), nunca por id ni por nombre: renombrar la asesoría desde el admin no
// rompe la unión. `id` es solo el ancla de la página (#gratis, #premium, #barba).
export const RUTA_ASESORIAS = '/asesorias'
export const RUTA_RESERVA = '/reservar-corte'
export const CLAVE_ASESORIA_GRATIS = 'asesoria-gratis'
export const TEXTO_RESERVAR_ASESORIA = 'Reservar esta asesoría'

export const rutaAsesoria = (id) => `${RUTA_ASESORIAS}#${id}`
// La reserva arranca con la asesoría ya elegida (?servicio=<id>, el id real que devuelve la API). Es el camino rápido
// (como "Reservar solo este" en la carta): NO usa ?servicios=, así que al terminar la reserva no vacía el carrito.
export const rutaReservaAsesoria = (servicioId) => `${RUTA_RESERVA}?servicio=${servicioId}`

export const ASESORIAS = [
  {
    id: 'gratis',
    clave: CLAVE_ASESORIA_GRATIS,
    titulo: 'Asesoría de imagen gratis',
    resumen:
      'Una conversación breve sobre tu estilo y una recomendación del corte ideal para tu rostro y tu rutina. Sin compromiso.',
    Icono: FaWandMagicSparkles,
    descripcion:
      'Un primer encuentro sin costo ni compromiso para descubrir qué corte te favorece de verdad. Nuestra asesora de imagen te escucha, observa tu rostro y tu rutina, y te da una dirección clara antes de que te sientes en la silla.',
    incluye: [
      'Conversación breve sobre tu estilo, tu trabajo y tu rutina diaria',
      'Lectura rápida de la forma de tu rostro y del tipo de tu cabello',
      'Recomendación del corte que mejor te queda',
      'Orientación para elegir tu siguiente servicio, sin ninguna presión',
    ],
    paraQuien:
      'Para quien llega por primera vez, quiere cambiar de look después de mucho tiempo o simplemente no sabe qué pedirle a su barbero.',
    pasos: [
      { titulo: 'Reserva en línea', texto: 'Elige el día y la hora que te queden cómodos; la asesoría gratuita es de una por persona.' },
      { titulo: 'Conversamos', texto: 'Llegas unos minutos antes y dedicamos el tiempo a conocer tu estilo y tu rutina.' },
      { titulo: 'Decides', texto: 'Te vas con una recomendación clara y, si quieres, reservas tu corte con nosotros.' },
    ],
  },
  {
    id: 'premium',
    clave: 'asesoria-premium',
    titulo: 'Asesoría Premium',
    resumen:
      'Estudio completo de tu rostro, cabello y estructura. Te entregamos un plan de estilo y cuidado a tu medida.',
    Icono: FaCrown,
    descripcion:
      'Nuestra experiencia más completa: un estudio detallado de tu rostro, tu cabello y tu estructura, pensado para quien quiere una imagen cuidada y coherente. Sales con un plan de estilo y de cuidado hecho a tu medida.',
    incluye: [
      'Estudio completo de rostro, cabello y estructura',
      'Propuesta de corte y acabados para tu tipo de cabello',
      'Plan de cuidado y rutina de productos para el día a día',
      'Resumen escrito de las recomendaciones para que lo conserves',
      'Una sesión completa con tu asesora, sin prisas',
    ],
    paraQuien:
      'Para quien quiere renovar su imagen por completo, se prepara para un evento importante o busca una guía profesional que dure más que un solo corte.',
    pasos: [
      { titulo: 'Reserva tu hora', texto: 'Elige en línea el día y la hora de tu sesión; si quieres, añade tu corte justo después.' },
      { titulo: 'Estudio personalizado', texto: 'Analizamos tu rostro, tu cabello y tu estructura, y hablamos de cómo quieres verte.' },
      { titulo: 'Tu plan de estilo', texto: 'Recibes tus recomendaciones de corte, cuidado y productos para ponerlas en práctica desde el primer día.' },
    ],
  },
  {
    id: 'barba',
    clave: 'asesoria-barba',
    titulo: 'Asesoría de barba',
    resumen:
      'Diseñamos el perfil de barba que mejor encaja con tu rostro y te enseñamos a mantenerla en casa.',
    Icono: GiBeard,
    descripcion:
      'Una sesión dedicada a tu barba: estudiamos su crecimiento y la forma de tu rostro para diseñar el perfil que mejor te queda, y te enseñamos a mantenerlo en casa para que se vea impecable entre visitas.',
    incluye: [
      'Análisis del crecimiento, la densidad y las zonas de tu barba',
      'Diseño del perfil que mejor encaja con la forma de tu rostro',
      'Guía de cuidado: limpieza, hidratación y productos recomendados',
      'Demostración práctica para mantener el diseño en casa',
    ],
    paraQuien:
      'Para quien está dejando crecer su barba, quiere un cambio de forma o siente que no logra mantenerla como le gustaría.',
    pasos: [
      { titulo: 'Agenda tu sesión', texto: 'Elige en línea el día y la hora que mejor te queden.' },
      { titulo: 'Diseñamos tu perfil', texto: 'Evaluamos tu barba y definimos la forma y el largo que mejor te favorecen.' },
      { titulo: 'Aprendes a mantenerla', texto: 'Te mostramos paso a paso cómo cuidarla y perfilarla para conservar el resultado.' },
    ],
  },
]

// Une cada texto con su servicio de la API por `clave`. Devuelve los textos con `servicio` (el objeto de la API, con su
// id, precio y duración) o null si esa asesoría no está activa. Sin lista (aún cargando o error) todos llevan null.
export const unirAsesorias = (servicios) =>
  ASESORIAS.map((texto) => ({ ...texto, servicio: servicios?.find((s) => s.clave === texto.clave) ?? null }))
