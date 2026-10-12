import { describe, it, expect } from 'vitest'
import { formatearDelta, formatearDinero } from '../utils/formato'
import { formatearRango } from '../utils/fechas'
import { escalaEje, abreviarPesos, recortarTexto } from '../utils/graficos'

describe('formatearDelta', () => {
  it('sube, baja e igual con el porcentaje redondeado', () => {
    expect(formatearDelta(150, 100)).toEqual({ texto: '50%', direccion: 'sube' })
    expect(formatearDelta(185000, 220000)).toEqual({ texto: '16%', direccion: 'baja' })
    expect(formatearDelta(100, 100)).toEqual({ texto: '0%', direccion: 'igual' })
    expect(formatearDelta(1001, 1000)).toEqual({ texto: '0%', direccion: 'igual' })
  })

  it('actual en 0 contra una base positiva es -100%', () => {
    expect(formatearDelta(0, 50)).toEqual({ texto: '100%', direccion: 'baja' })
  })

  it('sin base (período anterior en 0) devuelve "—", nunca NaN ni ∞', () => {
    expect(formatearDelta(500, 0)).toEqual({ texto: '—', direccion: 'sin-base' })
    expect(formatearDelta(0, 0)).toEqual({ texto: '—', direccion: 'sin-base' })
  })

  it.each([[undefined, 5], [5, undefined], [null, null], [Number.NaN, 5], [5, Number.NaN], [Infinity, 5], ['a', 1]])(
    'datos inválidos (%s, %s) devuelven "—"',
    (actual, previo) => {
      const { texto, direccion } = formatearDelta(actual, previo)
      expect(texto).toBe('—')
      expect(direccion).toBe('sin-base')
    }
  )
})

describe('formatearDinero', () => {
  it('formatea con separador de miles y muestra $0 (no "Gratis") para cero', () => {
    expect(formatearDinero(185000)).toBe('$185.000')
    expect(formatearDinero(0)).toBe('$0')
  })
})

describe('formatearRango', () => {
  it('un día y un rango', () => {
    expect(formatearRango({ desde: '2026-10-04', hasta: '2026-10-04' })).toBe('4 oct')
    expect(formatearRango({ desde: '2026-09-28', hasta: '2026-10-04' })).toBe('28 sept – 4 oct')
  })
})

describe('escalaEje', () => {
  it.each([
    [80000, 80000, 20000],
    [75000, 80000, 20000],
    [1200, 2000, 500],
    [1200000, 2000000, 500000],
    [300000, 400000, 100000],
    [95000, 100000, 25000],
  ])('máximo %i → eje hasta %i en pasos de %i', (maximo, max, paso) => {
    expect(escalaEje(maximo)).toEqual({ max, paso })
  })

  it('el eje siempre cubre el dato más alto y tiene 4 tramos iguales', () => {
    for (const valor of [1, 7, 333, 18000, 49999, 250001, 9876543]) {
      const { max, paso } = escalaEje(valor)
      expect(max).toBeGreaterThanOrEqual(valor)
      expect(paso * 4).toBe(max)
    }
  })

  it.each([0, -5, Number.NaN, undefined])('sin datos (%s) usa una escala de ejemplo, no una vacía', (valor) => {
    const { max, paso } = escalaEje(valor)
    expect(max).toBeGreaterThan(0)
    expect(paso * 4).toBe(max)
  })
})

describe('abreviarPesos / recortarTexto', () => {
  it('abrevia miles y millones', () => {
    expect(abreviarPesos(0)).toBe('$0')
    expect(abreviarPesos(500)).toBe('$500')
    expect(abreviarPesos(20000)).toBe('$20 mil')
    expect(abreviarPesos(1500000)).toBe('$1,5 M')
  })

  it('recorta con elipsis solo cuando hace falta', () => {
    expect(recortarTexto('Corte', 10)).toBe('Corte')
    expect(recortarTexto('Corte clásico con barba perfilada', 12)).toBe('Corte clási…')
    expect(recortarTexto('x', 0)).toHaveLength(2)
  })
})
