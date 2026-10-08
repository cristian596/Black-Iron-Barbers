import { describe, it, expect } from 'vitest'
import {
  MENSAJE_UNA_ASESORIA,
  esAsesoria,
  esAsesoriaGratis,
  estadoDeAsesoria,
  horaDeMinutos,
  minutosDeHora,
  normalizarReserva,
  planCitas,
  separarPorArea,
} from '../utils/reservaAsesoria'
import { estadoDeTarjeta, evaluarAgregado } from '../utils/carrito'
import { ASESORIAS, rutaReservaAsesoria, unirAsesorias } from '../data/asesorias'
import { ASESORIAS_API, GRATIS_API, PREMIUM_API, BARBA_API } from './fixturesAsesorias'

const asesoria = (servicio) => ({ ...servicio, area: 'asesoria' })
const corte = (id, duracion_min, precio = 10000) => ({ id, nombre: `Corte ${id}`, duracion_min, precio })

describe('clasificación por área', () => {
  it('esAsesoria solo mira area; esAsesoriaGratis solo mira la clave estable (no el precio ni el nombre)', () => {
    expect(esAsesoria(asesoria(PREMIUM_API))).toBe(true)
    expect(esAsesoria(corte(1, 30))).toBe(false)
    expect(esAsesoriaGratis(GRATIS_API)).toBe(true)
    expect(esAsesoriaGratis({ ...PREMIUM_API, precio: 0, nombre: 'Asesoría gratis' })).toBe(false)
    expect(esAsesoriaGratis({ ...GRATIS_API, nombre: 'Otro nombre', id: 5 })).toBe(true)
  })

  it('separarPorArea', () => {
    const a = asesoria(PREMIUM_API)
    expect(separarPorArea([corte(1, 30), a, corte(2, 30)])).toEqual({ asesoria: a, barberia: [corte(1, 30), corte(2, 30)] })
    expect(separarPorArea([corte(1, 30)])).toEqual({ asesoria: null, barberia: [corte(1, 30)] })
  })
})

describe('estadoDeAsesoria', () => {
  const premium = asesoria(PREMIUM_API)
  const barba = asesoria(BARBA_API)

  it('libre → no bloqueada; elegida → seleccionada', () => {
    expect(estadoDeAsesoria([], premium, [])).toEqual({ seleccionado: false, bloqueado: false, ayuda: null })
    expect(estadoDeAsesoria([premium], premium, [premium.id])).toEqual({ seleccionado: true, bloqueado: false, ayuda: null })
  })

  it('con otra asesoría elegida: bloqueada con el motivo en texto', () => {
    expect(estadoDeAsesoria([premium], barba, [premium.id])).toEqual({
      seleccionado: false,
      bloqueado: true,
      ayuda: MENSAJE_UNA_ASESORIA,
    })
  })

  it('con 3 servicios elegidos: bloqueada por el máximo', () => {
    const estado = estadoDeAsesoria([corte(1, 30), corte(2, 30), corte(3, 30)], premium, [1, 2, 3])
    expect(estado.bloqueado).toBe(true)
    expect(estado.ayuda).toMatch(/Máximo 3 servicios/)
  })
})

describe('el tope de duración cuenta solo la barbería', () => {
  it('evaluarAgregado con cantidadBarberia: una asesoría elegida no activa el tope de un servicio largo', () => {
    // 1 servicio elegido (la asesoría), 0 de barbería: un servicio de 300 min se puede añadir.
    expect(evaluarAgregado([], corte(9, 300), 1, 0).permitido).toBe(true)
    // Sin cantidadBarberia (comportamiento de siempre) se bloquea por duración a partir del segundo servicio.
    expect(evaluarAgregado([corte(1, 30)], corte(9, 300)).permitido).toBe(false)
    expect(evaluarAgregado([corte(1, 150)], corte(2, 120), 2, 1).motivo).toBe('duracion')
    expect(evaluarAgregado([corte(1, 30), corte(2, 30), corte(3, 30)], corte(4, 30), 3, 3).motivo).toBe('maximo')
  })

  it('estadoDeTarjeta mantiene su firma de siempre (3 argumentos)', () => {
    const estado = estadoDeTarjeta([corte(1, 30)], corte(2, 30), [1])
    expect(estado).toMatchObject({ seleccionado: false, bloqueado: false })
  })
})

describe('planCitas', () => {
  it('sin hora: orden asesoría → barbería, con duración y precio por cita y sin horarios', () => {
    const plan = planCitas([corte(1, 30, 20000), asesoria(PREMIUM_API), corte(2, 20, 5000)])
    expect(plan.map((c) => c.clave)).toEqual(['asesoria', 'barberia'])
    expect(plan[0]).toMatchObject({ duracion: 60, precio: 60000, inicio: null, fin: null })
    expect(plan[1]).toMatchObject({ duracion: 50, precio: 25000, inicio: null, fin: null })
    expect(plan[1].servicios.map((s) => s.id)).toEqual([1, 2])
  })

  it('con hora: la barbería empieza justo cuando termina la asesoría', () => {
    const plan = planCitas([asesoria(BARBA_API), corte(1, 30)], '10:00')
    expect(plan[0]).toMatchObject({ inicio: '10:00', fin: '10:45' })
    expect(plan[1]).toMatchObject({ inicio: '10:45', fin: '11:15' })
  })

  it('una sola cita: un solo grupo; también acepta horas con segundos', () => {
    expect(planCitas([corte(1, 30)], '09:30:00')).toEqual([expect.objectContaining({ clave: 'barberia', inicio: '09:30', fin: '10:00' })])
    expect(planCitas([asesoria(PREMIUM_API)], '18:00')).toEqual([expect.objectContaining({ clave: 'asesoria', fin: '19:00' })])
    expect(planCitas([], '10:00')).toEqual([])
  })

  it('minutosDeHora y horaDeMinutos son inversas', () => {
    expect(minutosDeHora('09:05')).toBe(545)
    expect(horaDeMinutos(545)).toBe('09:05')
    expect(horaDeMinutos(minutosDeHora('18:30:00'))).toBe('18:30')
  })
})

describe('normalizarReserva', () => {
  it('acepta la cita plana y la combinada { reserva_id, citas }', () => {
    const plana = { id: 1, hora: '10:00:00' }
    expect(normalizarReserva(plana)).toEqual({ reservaId: null, citas: [plana] })
    const citas = [{ id: 1 }, { id: 2 }]
    expect(normalizarReserva({ reserva_id: 'abc', citas })).toEqual({ reservaId: 'abc', citas })
  })
})

describe('textos de asesorías y unión con la API', () => {
  it('rutaReservaAsesoria usa el id real', () => {
    // MODIFICADO (fase 6, paso previo): camino rápido ?servicio= para no vaciar el carrito
    expect(rutaReservaAsesoria(270)).toBe('/reservar-corte?servicio=270')
  })

  it('unirAsesorias une por clave, no por posición ni por nombre', () => {
    const desordenado = [BARBA_API, { ...PREMIUM_API, nombre: 'Renombrada por el admin' }, GRATIS_API]
    const unidas = unirAsesorias(desordenado)
    expect(unidas.map((a) => a.id)).toEqual(['gratis', 'premium', 'barba'])
    expect(unidas.map((a) => a.servicio.id)).toEqual([GRATIS_API.id, PREMIUM_API.id, BARBA_API.id])
  })

  it('sin lista o con una asesoría ausente, servicio es null (nunca un precio inventado)', () => {
    expect(unirAsesorias(null).every((a) => a.servicio === null)).toBe(true)
    expect(unirAsesorias(ASESORIAS_API.slice(0, 2)).map((a) => a.servicio?.id ?? null)).toEqual([GRATIS_API.id, PREMIUM_API.id, null])
  })

  it('los textos no contienen precios ni duraciones numéricas ni WhatsApp', () => {
    const texto = JSON.stringify(ASESORIAS.map((a) => ({ ...a, Icono: undefined })))
    expect(texto).not.toMatch(/\$\s?\d|\b\d+\s?(minutos|min)\b|WhatsApp/i)
  })
})
