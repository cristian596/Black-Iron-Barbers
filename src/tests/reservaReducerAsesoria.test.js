import { describe, it, expect } from 'vitest'
import {
  MENSAJE_ELEGIR_OTRA_ASESORIA,
  MENSAJE_GRATIS_QUITADA,
  MENSAJE_GRATIS_QUITADA_SIN_SERVICIOS,
  MENSAJE_PROFESIONAL_INCOMPATIBLE,
  estadoInicialReserva,
  mensajeErrorSeleccion,
  reservaReducer,
} from '../components/sections/reserva/reservaReducer'
import { etiquetaPasoProfesional } from '../components/sections/reserva/pasos'

const conFechaYHora = (estado) => ({ ...estado, fecha: '2030-06-15', hora: '10:00' })

describe('reservaReducer con asesoría', () => {
  it('arranca con asesorId null (cualquier asesor) y sin foco pendiente', () => {
    expect(estadoInicialReserva([5, 1])).toMatchObject({ servicioIds: [5, 1], barberoId: null, asesorId: null, enfocarAsesoria: false })
    expect(estadoInicialReserva([5], 2, 7)).toMatchObject({ barberoId: 2, asesorId: 7 })
  })

  it('SELECCIONAR_ASESOR invalida fecha y hora (el calendario depende del asesor)', () => {
    const estado = reservaReducer(conFechaYHora(estadoInicialReserva([5])), { type: 'SELECCIONAR_ASESOR', asesorId: 37 })
    expect(estado).toMatchObject({ asesorId: 37, fecha: '', hora: '' })
  })

  it('cambiar el barbero NO toca al asesor y al revés', () => {
    const base = estadoInicialReserva([5, 1], null, 37)
    expect(reservaReducer(base, { type: 'SELECCIONAR_BARBERO', barberoId: 2 })).toMatchObject({ barberoId: 2, asesorId: 37 })
    expect(reservaReducer(estadoInicialReserva([5, 1], 2, null), { type: 'SELECCIONAR_ASESOR', asesorId: 38 })).toMatchObject({
      barberoId: 2,
      asesorId: 38,
    })
  })

  it('ERROR_PROFESIONAL: vuelve al paso de profesionales, olvida ambas elecciones y la hora, con el mensaje', () => {
    const estado = reservaReducer(conFechaYHora({ ...estadoInicialReserva([5, 1], 2, 37), paso: 'confirmar' }), {
      type: 'ERROR_PROFESIONAL',
      mensaje: MENSAJE_PROFESIONAL_INCOMPATIBLE,
    })
    expect(estado).toMatchObject({
      paso: 'barbero',
      barberoId: null,
      asesorId: null,
      fecha: '',
      hora: '',
      errorGlobal: MENSAJE_PROFESIONAL_INCOMPATIBLE,
    })
    expect(estado.servicioIds).toEqual([5, 1]) // los servicios se conservan
  })

  describe('QUITAR_ASESORIA_GRATIS', () => {
    const base = { ...conFechaYHora(estadoInicialReserva([5, 1], 2, 37)), paso: 'confirmar' }

    it('"Quitar" con más servicios: sigue la reserva en Fecha y hora, sin hora y sin asesor', () => {
      const estado = reservaReducer(base, { type: 'QUITAR_ASESORIA_GRATIS', gratisId: 5, otra: false })
      expect(estado).toMatchObject({ servicioIds: [1], paso: 'fecha-hora', hora: '', asesorId: null, errorGlobal: MENSAJE_GRATIS_QUITADA })
      expect(estado.fecha).toBe('2030-06-15') // la fecha se conserva; la hora cambia porque el corte ya no va después de la asesoría
    })

    it('"Quitar" cuando era lo único: vuelve a elegir servicios', () => {
      const estado = reservaReducer({ ...base, servicioIds: [5] }, { type: 'QUITAR_ASESORIA_GRATIS', gratisId: 5, otra: false })
      expect(estado).toMatchObject({ servicioIds: [], paso: 'servicio', fecha: '', hora: '', errorGlobal: MENSAJE_GRATIS_QUITADA_SIN_SERVICIOS })
    })

    it('"Elegir otra": al paso Servicio con el foco en el bloque de asesorías; el resto se conserva', () => {
      const estado = reservaReducer(base, { type: 'QUITAR_ASESORIA_GRATIS', gratisId: 5, otra: true })
      expect(estado).toMatchObject({
        servicioIds: [1],
        paso: 'servicio',
        fecha: '',
        hora: '',
        enfocarAsesoria: true,
        errorGlobal: MENSAJE_ELEGIR_OTRA_ASESORIA,
      })
    })

    it('el foco pendiente se apaga al cambiar la selección o de paso', () => {
      const conFoco = reservaReducer(base, { type: 'QUITAR_ASESORIA_GRATIS', gratisId: 5, otra: true })
      expect(reservaReducer(conFoco, { type: 'SELECCIONAR_SERVICIOS', servicioIds: [1, 6] }).enfocarAsesoria).toBe(false)
      expect(reservaReducer(conFoco, { type: 'IR_A_PASO', paso: 'barbero' }).enfocarAsesoria).toBe(false)
    })
  })

  it('LIMITE_ASESORIAS tiene mensaje de selección (vuelve al paso Servicio) y PROFESIONAL_INCOMPATIBLE no', () => {
    expect(mensajeErrorSeleccion('LIMITE_ASESORIAS')).toMatch(/una asesoría/)
    expect(mensajeErrorSeleccion('PROFESIONAL_INCOMPATIBLE')).toBeUndefined()
  })
})

describe('etiquetaPasoProfesional', () => {
  it('Barbero / Asesor/a / Profesionales', () => {
    expect(etiquetaPasoProfesional(false, true)).toBe('Barbero')
    expect(etiquetaPasoProfesional(true, false)).toBe('Asesor/a')
    expect(etiquetaPasoProfesional(true, true)).toBe('Profesionales')
  })
})
