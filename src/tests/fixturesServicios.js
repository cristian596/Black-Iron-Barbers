// Servicios con la forma que devuelve GET /api/servicios (lista plana, ordenada por categoría).
export const CORTES = { id: 1, nombre: 'Cortes', slug: 'cortes' }
export const BARBA = { id: 2, nombre: 'Barba', slug: 'barba' }
export const FACIALES = { id: 3, nombre: 'Faciales', slug: 'faciales' }

const servicio = (id, nombre, tipo, precio, duracion_min, categoria) => ({
  id,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  tipo,
  precio,
  duracion_min,
  categoria,
})

export const SERVICIOS_API = [
  servicio(1, 'Corte clásico', 'original', 18000, 30, CORTES),
  servicio(2, 'Corte degradado (Fade)', 'elite', 25000, 40, CORTES),
  servicio(3, 'Corte premium con asesoría de imagen', 'vip', 40000, 60, CORTES),
  servicio(4, 'Perfilado de barba', 'original', 12000, 20, BARBA),
  servicio(5, 'Ritual VIP de barba', 'vip', 35000, 45, BARBA),
  servicio(6, 'Limpieza facial básica', 'elite', 25000, 30, FACIALES),
]

export const SERVICIO_GRATIS = servicio(7, 'Asesoría gratuita', 'original', 0, 15, {
  id: 4,
  nombre: 'Asesorías',
  slug: 'asesorias',
})
