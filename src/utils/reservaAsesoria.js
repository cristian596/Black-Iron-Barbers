import { AREA_ASESORIA } from './areas'
import { CLAVE_ASESORIA_GRATIS } from '../data/asesorias'
import { MAX_SERVICIOS, MENSAJE_MAXIMO, duracionTotal, precioTotal } from './carrito'

// Reglas y cálculos de una reserva que puede incluir UNA asesoría. Las asesorías llegan de la API con `area: 'asesoria'`
// (el flujo de reserva las etiqueta al cargarlas); el resto es de barbería. Una reserva con asesoría + barbería son DOS
// citas: la asesoría primero y la de barbería justo al terminar (lo decide el back-end; aquí solo se muestra).

export const MENSAJE_UNA_ASESORIA = 'Solo puedes añadir una asesoría por reserva. Quita la actual para elegir otra.'
export const MENSAJE_LIMITE_ASESORIAS = 'Solo puedes reservar una asesoría a la vez.'

export const esAsesoria = (servicio) => servicio?.area === AREA_ASESORIA
export const esAsesoriaGratis = (servicio) => servicio?.clave === CLAVE_ASESORIA_GRATIS

// { asesoria: servicio | null, barberia: [servicios] } de una selección ya resuelta (objetos del catálogo).
export const separarPorArea = (servicios) => ({
  asesoria: servicios.find(esAsesoria) ?? null,
  barberia: servicios.filter((servicio) => !esAsesoria(servicio)),
})

// Estado de la tarjeta de una asesoría frente a la selección: una sola por reserva y el tope de 3 servicios en total.
// { seleccionado, bloqueado, ayuda }; `ayuda` es el motivo del bloqueo, siempre en texto.
export const estadoDeAsesoria = (seleccion, asesoria, ids) => {
  if (ids.includes(asesoria.id)) return { seleccionado: true, bloqueado: false, ayuda: null }
  if (seleccion.some(esAsesoria)) return { seleccionado: false, bloqueado: true, ayuda: MENSAJE_UNA_ASESORIA }
  if (ids.length >= MAX_SERVICIOS) return { seleccionado: false, bloqueado: true, ayuda: MENSAJE_MAXIMO }
  return { seleccionado: false, bloqueado: false, ayuda: null }
}

export const minutosDeHora = (hora) => {
  const [horas, minutos] = String(hora).slice(0, 5).split(':').map(Number)
  return horas * 60 + minutos
}

export const horaDeMinutos = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

// Las citas de la reserva en el orden en que se atienden: [{ clave: 'asesoria' | 'barberia', servicios, duracion, precio,
// inicio, fin }]. Con `hora` (inicio de la reserva) cada cita lleva su inicio y su fin "HH:MM" (la segunda empieza cuando
// termina la primera); sin hora, null.
export const planCitas = (servicios, hora) => {
  const { asesoria, barberia } = separarPorArea(servicios)
  const grupos = []
  if (asesoria) grupos.push({ clave: 'asesoria', servicios: [asesoria] })
  if (barberia.length > 0) grupos.push({ clave: 'barberia', servicios: barberia })

  let cursor = hora ? minutosDeHora(hora) : null
  return grupos.map((grupo) => {
    const duracion = duracionTotal(grupo.servicios)
    const cita = {
      ...grupo,
      duracion,
      precio: precioTotal(grupo.servicios),
      inicio: cursor === null ? null : horaDeMinutos(cursor),
      fin: cursor === null ? null : horaDeMinutos(cursor + duracion),
    }
    if (cursor !== null) cursor += duracion
    return cita
  })
}

// POST /api/citas responde una cita plana (una sola) o { reserva_id, citas: [asesoría, barbería] } (combinada).
// Siempre devuelve { reservaId, citas }.
export const normalizarReserva = (respuesta) =>
  Array.isArray(respuesta?.citas)
    ? { reservaId: respuesta.reserva_id ?? null, citas: respuesta.citas }
    : { reservaId: null, citas: [respuesta] }

export const TITULO_CITA = { asesoria: 'Asesoría', barberia: 'Barbería' }
