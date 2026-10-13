import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hoyISO } from '../utils/fechas'
import * as formato from '../utils/formato'

// 22:00 en Bogotá (UTC-5) del 4 de octubre = 03:00 UTC del 5 de octubre.
// Con UTC (el error anterior) "hoy" salía como 2026-10-05.
const NOCHE_BOGOTA = new Date('2026-10-05T03:00:00Z')

describe('hoyISO usa America/Bogota', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOCHE_BOGOTA)
  })
  afterEach(() => vi.useRealTimers())

  it('a las 22:00 de Bogotá devuelve el mismo día, no el siguiente en UTC', () => {
    expect(hoyISO()).toBe('2026-10-04')
  })

  it('formato.js ya no exporta una segunda versión basada en UTC', () => {
    expect(formato.hoyISO).toBeUndefined()
  })

})
