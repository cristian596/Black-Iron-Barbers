// Áreas de trabajo del personal y de los servicios: 'barberia' (cortes, barba…) y 'asesoria' (asesorías de imagen).
// El back-end es la fuente de verdad (`area` en /api/barberos, /api/servicios y la sesión); aquí solo se centraliza
// cómo la usa el front. No confundir con `tipo` (original / élite / VIP).

export const AREA_BARBERIA = 'barberia'
export const AREA_ASESORIA = 'asesoria'

// Quien llega sin `area` (datos anteriores o una respuesta antigua) es de barbería, igual que el DEFAULT de la base.
export const esDeBarberia = (profesional) => (profesional?.area ?? AREA_BARBERIA) === AREA_BARBERIA

// Solo el personal que corta: lo que ofrecen la reserva de cortes, el conteo del hero/estadísticas y la reasignación
// de citas. "Nuestro Equipo" NO lo usa: ahí se muestra a todos, también a la asesora.
export const soloBarberia = (profesionales) => (Array.isArray(profesionales) ? profesionales.filter(esDeBarberia) : profesionales)

// Palabras del panel del barbero según su área: quien atiende asesorías ve "Asesorías" donde un barbero ve "Cortes".
// Solo textos: ni los permisos ni las consultas cambian.
export const vocabularioPanel = (area) =>
  area === AREA_ASESORIA
    ? {
        etiquetaTotal: 'Asesorías',
        delMes: 'Asesorías del mes',
        unidad: 'asesoría',
        unidades: 'asesorías',
        sinCompletadas: 'No tienes asesorías completadas en este período.',
      }
    : {
        etiquetaTotal: 'Cortes',
        delMes: 'Cortes del mes',
        unidad: 'corte',
        unidades: 'cortes',
        sinCompletadas: 'No tienes cortes completados en este período.',
      }
