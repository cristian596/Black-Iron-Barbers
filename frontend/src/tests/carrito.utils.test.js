import { describe, it, expect } from 'vitest'
import {
  MAX_DURACION_COMBO_MIN,
  MAX_SERVICIOS,
  avisoMismaCategoria,
  categoriasRepetidas,
  duracionTotal,
  enlaceReservaIndividual,
  enlaceReservaSeleccion,
  evaluarAgregado,
  precioTotal,
  textoServicios,
} from '../utils/carrito'
import { formatearDuracion } from '../utils/formato'
import { SERVICIOS_API, SERVICIO_GRATIS } from './fixturesServicios'

const [CLASICO, FADE, PREMIUM, BARBA] = SERVICIOS_API
const conDuracion = (servicio, duracion_min, id = servicio.id) => ({ ...servicio, id, duracion_min })

describe('reglas de la selección', () => {
  it('constantes: máximo 3 servicios y 240 min para combos', () => {
    expect(MAX_SERVICIOS).toBe(3)
    expect(MAX_DURACION_COMBO_MIN).toBe(240)
  })

  it('suma duración y precio', () => {
    expect(duracionTotal([CLASICO, FADE])).toBe(70)
    expect(precioTotal([CLASICO, FADE])).toBe(43000)
    expect(precioTotal([])).toBe(0)
    expect(precioTotal([SERVICIO_GRATIS])).toBe(0)
  })

  it('el cuarto servicio no se permite', () => {
    expect(evaluarAgregado([CLASICO, FADE, PREMIUM], BARBA)).toMatchObject({ permitido: false, motivo: 'maximo' })
    expect(evaluarAgregado([CLASICO, FADE], BARBA).permitido).toBe(true)
  })

  it('un servicio individual nunca se bloquea por el tope de 240 min, aunque dure 300 o 600', () => {
    expect(evaluarAgregado([], conDuracion(CLASICO, 300)).permitido).toBe(true)
    expect(evaluarAgregado([], conDuracion(CLASICO, 600)).permitido).toBe(true)
  })

  it('un combo sí: 240 min exactos se permiten y 241 no', () => {
    const base = [conDuracion(CLASICO, 120)]
    expect(evaluarAgregado(base, conDuracion(BARBA, 120)).permitido).toBe(true)
    expect(evaluarAgregado(base, conDuracion(BARBA, 121))).toMatchObject({ permitido: false, motivo: 'duracion' })
    // y un servicio largo ya elegido bloquea cualquier combo
    expect(evaluarAgregado([conDuracion(CLASICO, 300)], conDuracion(BARBA, 20)).permitido).toBe(false)
  })

  it('el aviso de misma categoría solo aparece con otro servicio de esa categoría', () => {
    expect(avisoMismaCategoria([CLASICO], FADE)).toBe('Ya tienes un servicio de Cortes; puedes continuar si quieres ambos.')
    expect(avisoMismaCategoria([CLASICO], BARBA)).toBeNull()
    expect(avisoMismaCategoria([CLASICO], CLASICO)).toBeNull() // él mismo no cuenta
    expect(avisoMismaCategoria([], FADE)).toBeNull()
  })

  it('categoriasRepetidas lista las categorías con 2 o más servicios', () => {
    expect(categoriasRepetidas([CLASICO, FADE, BARBA])).toEqual(['Cortes'])
    expect(categoriasRepetidas([CLASICO, BARBA])).toEqual([])
  })

  it('arma los enlaces de reserva: con los ids en orden y el individual', () => {
    expect(enlaceReservaSeleccion([3, 1, 2])).toBe('/reservar-corte?servicios=3,1,2')
    expect(enlaceReservaSeleccion([7])).toBe('/reservar-corte?servicios=7')
    expect(enlaceReservaIndividual(4)).toBe('/reservar-corte?servicio=4')
  })

  it('singular y plural', () => {
    expect(textoServicios(1)).toBe('1 servicio')
    expect(textoServicios(2)).toBe('2 servicios')
    expect(textoServicios(3)).toBe('3 servicios')
  })
})

describe('formatearDuracion', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [70, '1 h 10 min'],
    [240, '4 h'],
    [300, '5 h'],
  ])('%i min → %s', (minutos, esperado) => {
    expect(formatearDuracion(minutos)).toBe(esperado)
  })
})
