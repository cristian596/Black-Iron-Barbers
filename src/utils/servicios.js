import { TIPO_TODOS } from '../data/tiposServicio'

// Clave del filtro de categoría que no restringe (muestra todas).
export const CATEGORIA_TODAS = 'todas'
const CLAVE_OTROS = 'otros'
const NOMBRE_OTROS = 'Otros'

// La API puede devolver servicios sin categoría (hoy el seed no los genera); se agrupan en "Otros".
export const claveCategoria = (servicio) => servicio.categoria?.slug ?? CLAVE_OTROS
export const nombreCategoria = (servicio) => servicio.categoria?.nombre ?? NOMBRE_OTROS

// Sin tildes ni mayúsculas, para que "clasico" encuentre "Corte clásico".
export const normalizarTexto = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Categorías en el orden en que llegan de la API (que ya viene ordenado por categoría); "Otros" al final.
export const categoriasDe = (servicios) => {
  const vistas = new Map()
  servicios.forEach((servicio) => {
    const clave = claveCategoria(servicio)
    if (!vistas.has(clave)) vistas.set(clave, nombreCategoria(servicio))
  })
  const lista = [...vistas].map(([slug, nombre]) => ({ slug, nombre }))
  return [...lista.filter((c) => c.slug !== CLAVE_OTROS), ...lista.filter((c) => c.slug === CLAVE_OTROS)]
}

export const agruparPorCategoria = (servicios) =>
  categoriasDe(servicios).map((categoria) => ({
    ...categoria,
    servicios: servicios.filter((servicio) => claveCategoria(servicio) === categoria.slug),
  }))

// Con texto de búsqueda se ignora la categoría (la búsqueda recorre todo el catálogo).
export const filtrarServicios = (servicios, { categoria = CATEGORIA_TODAS, tipo = TIPO_TODOS, busqueda = '' } = {}) => {
  const texto = normalizarTexto(busqueda)

  return servicios.filter((servicio) => {
    if (tipo !== TIPO_TODOS && servicio.tipo !== tipo) return false
    if (texto) return normalizarTexto(servicio.nombre).includes(texto)
    return categoria === CATEGORIA_TODAS || claveCategoria(servicio) === categoria
  })
}
