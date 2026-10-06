import { MAX_SERVICIOS } from './carrito'

// Servicios con los que arranca la reserva, leídos de la URL:
//  · ?servicios=1,2,3 → viene del carrito. Se leen enteros positivos, se ignora la basura ("abc", "-4", "2.5", vacíos),
//    los repetidos (queda la primera aparición) y todo lo que pase de MAX_SERVICIOS.
//  · ?servicio=<id>   → camino rápido desde una tarjeta (un solo servicio).
// Si vienen los dos, manda ?servicios= siempre que traiga al menos un id válido; si no, se usa ?servicio=.
// Devuelve { ids, desdeCarrito }: `desdeCarrito` es true solo si los ids salen de ?servicios= (decide si al reservar
// con éxito se vacía el carrito).
const ENTERO = /^\d{1,9}$/

const idValido = (texto) => {
  const limpio = String(texto ?? '').trim()
  if (!ENTERO.test(limpio)) return null
  const id = Number(limpio)
  return id >= 1 ? id : null
}

export const parsearListaServicios = (texto) => {
  const ids = []
  for (const parte of String(texto ?? '').split(',')) {
    const id = idValido(parte)
    if (id !== null && !ids.includes(id)) ids.push(id)
  }
  return ids.slice(0, MAX_SERVICIOS)
}

export const leerServiciosDeUrl = (searchParams) => {
  const lista = parsearListaServicios(searchParams.get('servicios'))
  if (lista.length > 0) return { ids: lista, desdeCarrito: true }

  const individual = idValido(searchParams.get('servicio'))
  return individual === null ? { ids: [], desdeCarrito: false } : { ids: [individual], desdeCarrito: false }
}

// Normaliza una lista de ids a lo que admite una reserva: enteros positivos, sin repetir, máximo 3.
export const normalizarIds = (ids) => {
  const limpios = []
  for (const id of Array.isArray(ids) ? ids : []) {
    if (Number.isInteger(id) && id >= 1 && !limpios.includes(id)) limpios.push(id)
  }
  return limpios.slice(0, MAX_SERVICIOS)
}

export const mismosIds = (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
