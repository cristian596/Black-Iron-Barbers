import { describe, it, expect } from 'vitest'
import { reservaReducer, estadoInicialReserva } from '../components/sections/reserva/reservaReducer'

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
