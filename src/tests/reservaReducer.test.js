import { describe, it, expect } from 'vitest'
import {
  reservaReducer,
  estadoInicialReserva,
  MENSAJE_SERVICIO_NO_DISPONIBLE,
} from '../components/sections/reserva/reservaReducer'

describe('reservaReducer', () => {
  it('estadoInicialReserva usa "Cualquier barbero" (null) por defecto', () => {
    const estado = estadoInicialReserva()
    expect(estado.paso).toBe('servicio')
    expect(estado.barberoId).toBeNull()
    expect(estado.servicioId).toBe('')
  })

  it('SELECCIONAR_SERVICIO invalida fecha y hora, pero no el barbero', () => {
    const estado = { ...estadoInicialReserva(), barberoId: 3, fecha: '2030-01-10', hora: '10:00' }
    const nuevo = reservaReducer(estado, { type: 'SELECCIONAR_SERVICIO', servicioId: 2 })

    expect(nuevo.servicioId).toBe(2)
    expect(nuevo.barberoId).toBe(3)
    expect(nuevo.fecha).toBe('')
    expect(nuevo.hora).toBe('')
  })

  it('SELECCIONAR_BARBERO invalida fecha y hora, pero no el servicio', () => {
    const estado = { ...estadoInicialReserva(), servicioId: 1, fecha: '2030-01-10', hora: '10:00' }
    const nuevo = reservaReducer(estado, { type: 'SELECCIONAR_BARBERO', barberoId: 5 })

    expect(nuevo.barberoId).toBe(5)
    expect(nuevo.servicioId).toBe(1)
    expect(nuevo.fecha).toBe('')
    expect(nuevo.hora).toBe('')
  })

  it('SELECCIONAR_FECHA invalida la hora elegida', () => {
    const estado = { ...estadoInicialReserva(), hora: '10:00' }
    const nuevo = reservaReducer(estado, { type: 'SELECCIONAR_FECHA', fecha: '2030-02-01' })

    expect(nuevo.fecha).toBe('2030-02-01')
    expect(nuevo.hora).toBe('')
  })

  it('IR_A_PASO cambia el paso sin tocar las demás selecciones', () => {
    const estado = { ...estadoInicialReserva(), servicioId: 1, barberoId: 2 }
    const nuevo = reservaReducer(estado, { type: 'IR_A_PASO', paso: 'confirmar' })

    expect(nuevo.paso).toBe('confirmar')
    expect(nuevo.servicioId).toBe(1)
    expect(nuevo.barberoId).toBe(2)
  })

  it('RESERVA_CONFIRMADA mueve al paso "exito" y guarda el resumen del servidor', () => {
    const resumen = { id: 1, barbero_nombre: 'Boby' }
    const nuevo = reservaReducer(estadoInicialReserva(), { type: 'RESERVA_CONFIRMADA', resumen })

    expect(nuevo.paso).toBe('exito')
    expect(nuevo.resumen).toEqual(resumen)
  })

  it('REINICIAR vuelve al estado inicial', () => {
    const estado = { ...estadoInicialReserva(), servicioId: 1, paso: 'confirmar' }
    const nuevo = reservaReducer(estado, { type: 'REINICIAR' })

    expect(nuevo).toEqual(estadoInicialReserva())
  })
})

describe('reservaReducer — SERVICIO_NO_DISPONIBLE', () => {
  const estadoAvanzado = {
    ...estadoInicialReserva(7, 2),
    paso: 'confirmar',
    fecha: '2030-06-15',
    hora: '10:00',
    recargaHoras: 3,
  }

  it('vuelve al paso Servicio, vacía servicio, fecha y hora, y deja el aviso', () => {
    const nuevo = reservaReducer(estadoAvanzado, { type: 'SERVICIO_NO_DISPONIBLE' })

    expect(nuevo.paso).toBe('servicio')
    expect(nuevo.servicioId).toBe('')
    expect(nuevo.fecha).toBe('')
    expect(nuevo.hora).toBe('')
    expect(nuevo.errorGlobal).toBe('Ese servicio ya no está disponible. Elige otro de la lista.')
    expect(nuevo.errorGlobal).toBe(MENSAJE_SERVICIO_NO_DISPONIBLE)
  })

  it('no toca el barbero elegido ni el resto del estado', () => {
    const nuevo = reservaReducer(estadoAvanzado, { type: 'SERVICIO_NO_DISPONIBLE' })

    expect(nuevo.barberoId).toBe(2)
    expect(nuevo.recargaHoras).toBe(3)
    expect(nuevo.resumen).toBeNull()
  })

  it('funciona igual desde cualquier paso (modal abierto, fecha-hora o el propio paso Servicio)', () => {
    ;['confirmar', 'fecha-hora', 'servicio'].forEach((paso) => {
      const nuevo = reservaReducer({ ...estadoAvanzado, paso }, { type: 'SERVICIO_NO_DISPONIBLE' })
      expect(nuevo.paso).toBe('servicio')
      expect(nuevo.servicioId).toBe('')
    })
  })

  it('el aviso es de una sola vez: elegir otro servicio lo limpia e invalida fecha y hora como siempre', () => {
    const tras = reservaReducer(estadoAvanzado, { type: 'SERVICIO_NO_DISPONIBLE' })
    const elegido = reservaReducer(
      { ...tras, fecha: '2030-06-16', hora: '11:00' },
      { type: 'SELECCIONAR_SERVICIO', servicioId: 4 }
    )

    expect(elegido.errorGlobal).toBe('')
    expect(elegido.servicioId).toBe(4)
    expect(elegido.fecha).toBe('')
    expect(elegido.hora).toBe('')
  })

  it('no muta el estado anterior', () => {
    const copia = structuredClone(estadoAvanzado)
    reservaReducer(estadoAvanzado, { type: 'SERVICIO_NO_DISPONIBLE' })
    expect(estadoAvanzado).toEqual(copia)
  })
})
