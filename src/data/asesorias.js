import { FaCrown, FaWandMagicSparkles } from 'react-icons/fa6'
import { GiBeard } from 'react-icons/gi'

// Asesorías de imagen (datos ficticios de portafolio): única fuente para el modal de "Soy cliente nuevo"
// y, en la fase siguiente, para la página /asesorias.
// Para cambiar un precio o una duración basta con editar `precio` (COP; 0 = "Gratis") o `duracion_min` aquí.
// PROVISIONAL: las duraciones están por confirmar.
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
  },
  {
    id: 'premium',
    titulo: 'Asesoría Premium',
    precio: 60000,
    duracion_min: 60,
    resumen:
      'Estudio completo de tu rostro, cabello y estructura. Te entregamos un plan de estilo y cuidado a tu medida.',
    Icono: FaCrown,
  },
  {
    id: 'barba',
    titulo: 'Asesoría de barba',
    precio: 45000,
    duracion_min: 45,
    resumen:
      'Diseñamos el perfil de barba que mejor encaja con tu rostro y te enseñamos a mantenerla en casa.',
    Icono: GiBeard,
  },
]
