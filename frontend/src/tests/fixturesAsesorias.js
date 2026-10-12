// Asesorías con la forma que devuelve GET /api/servicios?area=asesoria (precio, duración e id reales; `clave` estable).
// Los textos (descripciones, pasos…) NO vienen de aquí sino de src/data/asesorias.js.
const CATEGORIA = { id: 4, nombre: 'Asesorías', slug: 'asesorias' }

const asesoria = (id, clave, nombre, tipo, precio, duracion_min) => ({
  id,
  clave,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  tipo,
  precio,
  duracion_min,
  categoria: CATEGORIA,
})

export const GRATIS_API = asesoria(269, 'asesoria-gratis', 'Asesoría de imagen gratis', 'original', 0, 15)
export const PREMIUM_API = asesoria(270, 'asesoria-premium', 'Asesoría Premium', 'vip', 60000, 60)
export const BARBA_API = asesoria(271, 'asesoria-barba', 'Asesoría de barba', 'elite', 45000, 45)

export const ASESORIAS_API = [GRATIS_API, PREMIUM_API, BARBA_API]

// Personal con la forma de GET /api/barberos (campo `area`).
export const ASESORA = { id: 37, nombre: 'Camila', cargo: 'Asesora de Imagen', especialidad: 'Asesoría de imagen', foto: null, area: 'asesoria' }
export const ASESOR_2 = { id: 38, nombre: 'Mateo', cargo: 'Asesor de Imagen', especialidad: 'Asesoría de barba', foto: null, area: 'asesoria' }
