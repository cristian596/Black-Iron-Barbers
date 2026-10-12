import { describe, it, expect } from 'vitest'
import { formatearPrecio } from '../utils/formato'

describe('formatearPrecio', () => {
  it('precio 0 se muestra como "Gratis"', () => {
    expect(formatearPrecio(0)).toBe('Gratis')
  })

  it('formatea con signo $ y separador de miles es-CO', () => {
    expect(formatearPrecio(18000)).toBe('$18.000')
    expect(formatearPrecio(130000)).toBe('$130.000')
    expect(formatearPrecio(500)).toBe('$500')
  })

  it('acepta el precio como texto numérico', () => {
    expect(formatearPrecio('0')).toBe('Gratis')
    expect(formatearPrecio('25000')).toBe('$25.000')
  })
})
