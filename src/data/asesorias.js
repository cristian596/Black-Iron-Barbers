import { FaCrown, FaWandMagicSparkles } from 'react-icons/fa6'
import { GiBeard } from 'react-icons/gi'

// Asesorías de imagen (datos ficticios de portafolio): única fuente para el modal de "Soy cliente nuevo"
// y para la página /asesorias.
// Para cambiar un precio o una duración basta con editar `precio` (COP; 0 = "Gratis") o `duracion_min` aquí:
// el modal, la franja resumen y cada sección se actualizan solos.
// PROVISIONAL: las duraciones están por confirmar.
// TEMPORAL: mientras las asesorías no se puedan reservar con el sistema de citas (fase siguiente), el botón de
// cada sección abre WhatsApp con `mensajeWhatsApp`. Al llegar esa fase, ese botón pasa a la reserva.
export const RUTA_ASESORIAS = '/asesorias'

export const rutaAsesoria = (id) => `${RUTA_ASESORIAS}#${id}`

export const ASESORIAS = [
  {
    id: 'gratis',
    titulo: 'Asesoría de imagen gratis',
    precio: 0,
    duracion_min: 15,
    resumen:
      'Conversamos 15 minutos sobre tu estilo y te recomendamos el corte ideal para tu rostro y tu rutina. Sin compromiso.',
    Icono: FaWandMagicSparkles,
    descripcion:
      'Un primer encuentro sin costo ni compromiso para descubrir qué corte te favorece de verdad. Nuestra asesora de imagen te escucha, observa tu rostro y tu rutina, y te da una dirección clara antes de que te sientes en la silla.',
    incluye: [
      'Conversación de 15 minutos sobre tu estilo, tu trabajo y tu rutina diaria',
      'Lectura rápida de la forma de tu rostro y del tipo de tu cabello',
      'Recomendación del corte que mejor te queda',
      'Orientación para elegir tu siguiente servicio, sin ninguna presión',
    ],
    paraQuien:
      'Para quien llega por primera vez, quiere cambiar de look después de mucho tiempo o simplemente no sabe qué pedirle a su barbero.',
    pasos: [
      { titulo: 'Escríbenos', texto: 'Cuéntanos por WhatsApp que quieres tu asesoría y elige un horario que te quede cómodo.' },
      { titulo: 'Conversamos', texto: 'Llegas unos minutos antes y dedicamos 15 minutos a conocer tu estilo y tu rutina.' },
      { titulo: 'Decides', texto: 'Te vas con una recomendación clara y, si quieres, reservas tu corte con nosotros.' },
    ],
    textoBoton: 'Quiero mi asesoría gratis',
    mensajeWhatsApp: '¡Hola! Quiero agendar la asesoría de imagen gratis en Black Iron Barbers.',
  },
  {
    id: 'premium',
    titulo: 'Asesoría Premium',
    precio: 60000,
    duracion_min: 60,
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
      'Una hora con tu asesora, sin prisas',
    ],
    paraQuien:
      'Para quien quiere renovar su imagen por completo, se prepara para un evento importante o busca una guía profesional que dure más que un solo corte.',
    pasos: [
      { titulo: 'Reserva tu hora', texto: 'Escríbenos por WhatsApp y acordamos el día y la hora de tu sesión de 60 minutos.' },
      { titulo: 'Estudio personalizado', texto: 'Analizamos tu rostro, tu cabello y tu estructura, y hablamos de cómo quieres verte.' },
      { titulo: 'Tu plan de estilo', texto: 'Recibes tus recomendaciones de corte, cuidado y productos para ponerlas en práctica desde el primer día.' },
    ],
    textoBoton: 'Reservar mi asesoría Premium',
    mensajeWhatsApp: '¡Hola! Quiero agendar la Asesoría Premium en Black Iron Barbers.',
  },
  {
    id: 'barba',
    titulo: 'Asesoría de barba',
    precio: 45000,
    duracion_min: 45,
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
      { titulo: 'Agenda tu sesión', texto: 'Escríbenos por WhatsApp y elegimos juntos el horario de tus 45 minutos.' },
      { titulo: 'Diseñamos tu perfil', texto: 'Evaluamos tu barba y definimos la forma y el largo que mejor te favorecen.' },
      { titulo: 'Aprendes a mantenerla', texto: 'Te mostramos paso a paso cómo cuidarla y perfilarla para conservar el resultado.' },
    ],
    textoBoton: 'Quiero mi asesoría de barba',
    mensajeWhatsApp: '¡Hola! Quiero agendar la asesoría de barba en Black Iron Barbers.',
  },
]
