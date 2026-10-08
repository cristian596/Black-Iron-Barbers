import { MAX_DURACION_COMBO_MIN, MAX_SERVICIOS } from '../../../utils/carrito'
import { mismosIds, normalizarIds } from '../../../utils/seleccionReserva'
import { MENSAJE_LIMITE_ASESORIAS } from '../../../utils/reservaAsesoria'

export const MENSAJE_SERVICIO_NO_DISPONIBLE = 'Ese servicio ya no está disponible. Elige otro de la lista.'
export const MENSAJE_SERVICIOS_NO_DISPONIBLES =
  'Quitamos de tu selección lo que ya no está disponible. Revisa lo que queda o elige otros servicios.'

// Errores del servidor sobre la selección en sí (no deberían ocurrir si el cliente respeta las reglas, pero la URL o
// un catálogo que cambió pueden provocarlos): se vuelve al paso Servicio con un mensaje claro y la selección intacta.
const MENSAJES_ERROR_SELECCION = {
  SERVICIOS_REPETIDOS: 'No puedes repetir un servicio en la misma reserva.',
  LIMITE_SERVICIOS: `Puedes reservar máximo ${MAX_SERVICIOS} servicios a la vez.`,
  DURACION_EXCEDIDA: `Esa combinación dura más de ${MAX_DURACION_COMBO_MIN} min, el máximo para combos. Quita algún servicio.`,
  LIMITE_ASESORIAS: MENSAJE_LIMITE_ASESORIAS,
}
export const mensajeErrorSeleccion = (codigo) => MENSAJES_ERROR_SELECCION[codigo]

// El profesional elegido no atiende esos servicios (no debería pasar con la interfaz, pero un cambio de datos puede
// provocarlo): se vuelve al paso de profesionales para elegir de nuevo.
export const CODIGO_PROFESIONAL_INCOMPATIBLE = 'PROFESIONAL_INCOMPATIBLE'
export const MENSAJE_PROFESIONAL_INCOMPATIBLE = 'Ese profesional no atiende los servicios elegidos. Elige de nuevo a tu profesional.'
export const MENSAJE_GRATIS_QUITADA_SIN_SERVICIOS = 'Quitamos la asesoría gratuita. Elige un servicio para continuar.'
export const MENSAJE_GRATIS_QUITADA = 'Quitamos la asesoría gratuita. Elige de nuevo la hora de tu reserva.'
export const MENSAJE_ELEGIR_OTRA_ASESORIA = 'Quitamos la asesoría gratuita. Elige otra asesoría o continúa sin ella.'

// servicioIds: servicios elegidos, en orden (1 a 3, sin repetir; pueden incluir UNA asesoría). barberoId / asesorId:
// null significa "Cualquier barbero" / "Cualquier asesor" (opción por defecto), no "sin elegir". Solo se envían al
// servidor los que corresponden a los servicios elegidos.
export const estadoInicialReserva = (servicioIds = [], barberoId = null, asesorId = null) => ({
  paso: 'servicio',
  servicioIds: normalizarIds(servicioIds),
  barberoId,
  asesorId,
  // true cuando hay que llevar el foco al bloque de asesorías del paso Servicio (tras "Elegir otra asesoría").
  enfocarAsesoria: false,
  fecha: '',
  hora: '',
  // Se incrementa para forzar que PasoFechaHora vuelva a pedir disponibilidad
  // (por ejemplo tras un 409: la hora elegida ya no sirve, pero fecha/barbero no cambiaron).
  recargaHoras: 0,
  // Aviso de una sola vez para el paso Fecha y hora (p. ej. "esa hora ya se ocupó").
  errorGlobal: '',
  resumen: null,
})

export const reservaReducer = (estado, accion) => {
  switch (accion.type) {
    case 'SELECCIONAR_SERVICIOS': {
      const servicioIds = normalizarIds(accion.servicioIds)
      // La duración total cambia la disponibilidad: si cambia la selección, fecha y hora ya no son válidas.
      if (mismosIds(servicioIds, estado.servicioIds)) return { ...estado, errorGlobal: '', enfocarAsesoria: false }
      return { ...estado, servicioIds, fecha: '', hora: '', errorGlobal: '', enfocarAsesoria: false }
    }

    case 'SERVICIO_NO_DISPONIBLE': {
      // Uno o más servicios elegidos ya no están activos (400 con codigo al confirmar o al pedir disponibilidad, o un
      // enlace viejo ?servicios=...): se quitan SOLO los afectados (`ids`; sin ids se asume que ninguno sirve) y se
      // vuelve al paso Servicio con un aviso de una sola vez. Lo que queda sigue elegido.
      const afectados = Array.isArray(accion.ids) ? accion.ids : null
      const servicioIds = afectados ? estado.servicioIds.filter((id) => !afectados.includes(id)) : []
      const quitados = estado.servicioIds.length - servicioIds.length
      const mensaje =
        servicioIds.length === 0 && quitados <= 1 ? MENSAJE_SERVICIO_NO_DISPONIBLE : MENSAJE_SERVICIOS_NO_DISPONIBLES
      return { ...estado, paso: 'servicio', servicioIds, fecha: '', hora: '', errorGlobal: mensaje }
    }

    case 'ERROR_SELECCION':
      return { ...estado, paso: 'servicio', fecha: '', hora: '', errorGlobal: accion.mensaje }

    case 'SELECCIONAR_BARBERO':
      // El calendario depende del barbero: fecha y hora ya no son válidas.
      return { ...estado, barberoId: accion.barberoId, fecha: '', hora: '', errorGlobal: '' }

    case 'SELECCIONAR_ASESOR':
      // Igual que con el barbero: el calendario depende del asesor.
      return { ...estado, asesorId: accion.asesorId, fecha: '', hora: '', errorGlobal: '' }

    case 'ERROR_PROFESIONAL':
      return { ...estado, paso: 'barbero', barberoId: null, asesorId: null, fecha: '', hora: '', errorGlobal: accion.mensaje }

    case 'QUITAR_ASESORIA_GRATIS': {
      // La persona ya usó su asesoría gratuita (comprobación temprana o 409 del servidor): se quita de la reserva. La
      // asesoría iba primero, así que cambia la hora de lo que queda: fecha y hora se vuelven a elegir.
      const servicioIds = estado.servicioIds.filter((id) => id !== accion.gratisId)
      const base = { ...estado, servicioIds, asesorId: null, hora: '', enfocarAsesoria: false }
      if (accion.otra) {
        return { ...base, paso: 'servicio', fecha: '', enfocarAsesoria: true, errorGlobal: MENSAJE_ELEGIR_OTRA_ASESORIA }
      }
      if (servicioIds.length === 0) {
        return { ...base, paso: 'servicio', fecha: '', errorGlobal: MENSAJE_GRATIS_QUITADA_SIN_SERVICIOS }
      }
      return { ...base, paso: 'fecha-hora', errorGlobal: MENSAJE_GRATIS_QUITADA }
    }

    case 'SELECCIONAR_FECHA':
      return { ...estado, fecha: accion.fecha, hora: '', errorGlobal: '' }

    case 'SELECCIONAR_HORA':
      return { ...estado, hora: accion.hora, errorGlobal: '' }

    case 'IR_A_PASO':
      return { ...estado, paso: accion.paso, errorGlobal: '', enfocarAsesoria: false }

    case 'HORA_OCUPADA':
      // 409 al confirmar: la hora ya no es válida, se vuelve al paso de fecha/hora
      // y se fuerza una recarga de disponibilidad real.
      return {
        ...estado,
        paso: 'fecha-hora',
        hora: '',
        recargaHoras: estado.recargaHoras + 1,
        errorGlobal: 'Esa hora ya fue tomada. Elige otra hora disponible.',
      }

    case 'RESERVA_CONFIRMADA':
      return { ...estado, paso: 'exito', resumen: accion.resumen }

    case 'REINICIAR':
      return estadoInicialReserva()

    default:
      return estado
  }
}
