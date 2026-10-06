import { claveCategoria, nombreCategoria } from './servicios'

// Reglas de la selección de servicios ("Tu selección"). El servidor las valida también (POST /api/citas):
// aquí solo se adelantan para no dejar al cliente llegar a un error.
export const MAX_SERVICIOS = 3
// Tope de duración total SOLO para combos (2 o más servicios). Un servicio individual nunca se bloquea por esto.
export const MAX_DURACION_COMBO_MIN = 240

export const MENSAJE_MAXIMO = `Máximo ${MAX_SERVICIOS} servicios por reserva`
export const MENSAJE_DURACION = `Con este servicio la selección pasaría de ${MAX_DURACION_COMBO_MIN} min, el máximo para combos`

export const duracionTotal = (seleccion) => seleccion.reduce((suma, servicio) => suma + servicio.duracion_min, 0)
export const precioTotal = (seleccion) => seleccion.reduce((suma, servicio) => suma + servicio.precio, 0)

// ¿Se puede añadir `servicio` a `seleccion`? { permitido, motivo: 'maximo' | 'duracion' | null, mensaje }.
// `cantidad` (opcional) es el número real de ids elegidos, por si aún no se conocen los datos de alguno.
export const evaluarAgregado = (seleccion, servicio, cantidad = seleccion.length) => {
  if (cantidad >= MAX_SERVICIOS) return { permitido: false, motivo: 'maximo', mensaje: MENSAJE_MAXIMO }
  if (cantidad >= 1 && duracionTotal(seleccion) + servicio.duracion_min > MAX_DURACION_COMBO_MIN) {
    return { permitido: false, motivo: 'duracion', mensaje: MENSAJE_DURACION }
  }
  return { permitido: true, motivo: null, mensaje: '' }
}

// Aviso suave (no bloquea) si ya hay un servicio de la misma categoría que `servicio`.
export const avisoMismaCategoria = (seleccion, servicio) => {
  const repetida = seleccion.some((s) => s.id !== servicio.id && claveCategoria(s) === claveCategoria(servicio))
  return repetida
    ? `Ya tienes un servicio de ${nombreCategoria(servicio)}; puedes continuar si quieres ambos.`
    : null
}

// Estado de una tarjeta de servicio frente a la selección actual (carta y paso 1 de la reserva comparten esta regla):
// { seleccionado, bloqueado, ayuda }. `ayuda` es el motivo del bloqueo (máximo o duración) o, si no bloquea, el aviso
// suave de categoría repetida; `ids` son los ids elegidos (pueden ser más que `seleccion` si aún no se conocen todos).
export const estadoDeTarjeta = (seleccion, servicio, ids) => {
  if (ids.includes(servicio.id)) return { seleccionado: true, bloqueado: false, ayuda: null }
  const evaluacion = evaluarAgregado(seleccion, servicio, ids.length)
  return {
    seleccionado: false,
    bloqueado: !evaluacion.permitido,
    ayuda: evaluacion.permitido ? avisoMismaCategoria(seleccion, servicio) : evaluacion.mensaje,
  }
}

// Categorías con 2 o más servicios elegidos (para el aviso dentro del carrito).
export const categoriasRepetidas = (seleccion) => {
  const conteo = new Map()
  seleccion.forEach((s) => {
    const clave = claveCategoria(s)
    conteo.set(clave, { nombre: nombreCategoria(s), n: (conteo.get(clave)?.n ?? 0) + 1 })
  })
  return [...conteo.values()].filter((c) => c.n > 1).map((c) => c.nombre)
}

export const enlaceReservaSeleccion = (ids) => `/reservar-corte?servicios=${ids.join(',')}`
export const enlaceReservaIndividual = (id) => `/reservar-corte?servicio=${id}`

export const textoServicios = (n) => `${n} ${n === 1 ? 'servicio' : 'servicios'}`

// ---- Persistencia (sessionStorage; puede no estar disponible: todo con try/catch) ----
const CLAVE = 'seleccion-servicios'

// Lee los ids guardados y descarta todo lo que no sea una lista de hasta 3 enteros positivos sin repetir.
export const leerSeleccionGuardada = () => {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    const lista = crudo ? JSON.parse(crudo) : []
    if (!Array.isArray(lista)) return []
    const ids = []
    for (const id of lista) {
      if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id)
    }
    return ids.slice(0, MAX_SERVICIOS)
  } catch {
    return []
  }
}

export const guardarSeleccion = (ids) => {
  try {
    if (ids.length === 0) sessionStorage.removeItem(CLAVE)
    else sessionStorage.setItem(CLAVE, JSON.stringify(ids))
  } catch {
    // sin sessionStorage: la selección dura lo que dure la página
  }
}
