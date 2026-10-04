export const MENSAJE_SERVICIO_NO_DISPONIBLE = 'Ese servicio ya no está disponible. Elige otro de la lista.'

// barberoId: null significa "Cualquier barbero" (opción por defecto), no "sin elegir".
export const estadoInicialReserva = (servicioId = '', barberoId = null) => ({
  paso: 'servicio',
  servicioId,
  barberoId,
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
    case 'SELECCIONAR_SERVICIO':
      // La duración del servicio cambia la disponibilidad: fecha y hora ya no son válidas.
      return { ...estado, servicioId: accion.servicioId, fecha: '', hora: '', errorGlobal: '' }

    case 'SERVICIO_NO_DISPONIBLE':
      // El servicio elegido ya no está activo (400 con codigo al confirmar o al pedir disponibilidad, o un
      // enlace viejo ?servicio=<id>): se vuelve al paso Servicio sin selección y con un aviso de una sola vez.
      return { ...estado, paso: 'servicio', servicioId: '', fecha: '', hora: '', errorGlobal: MENSAJE_SERVICIO_NO_DISPONIBLE }

    case 'SELECCIONAR_BARBERO':
      // El calendario depende del barbero: fecha y hora ya no son válidas.
      return { ...estado, barberoId: accion.barberoId, fecha: '', hora: '', errorGlobal: '' }

    case 'SELECCIONAR_FECHA':
      return { ...estado, fecha: accion.fecha, hora: '', errorGlobal: '' }

    case 'SELECCIONAR_HORA':
      return { ...estado, hora: accion.hora, errorGlobal: '' }

    case 'IR_A_PASO':
      return { ...estado, paso: accion.paso, errorGlobal: '' }

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
