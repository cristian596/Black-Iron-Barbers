import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { hoyISO } from '../utils/fechas'
import * as formato from '../utils/formato'
import Panel from '../pages/Panel'
import { obtenerCitas } from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: { usuario: 'leo', rol: 'barbero' }, token: 't', logout: vi.fn(), vigencia: null, actualizarVigencia: vi.fn() }),
}))

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

  it('el panel del barbero pide las citas del día de Bogotá', async () => {
    vi.mocked(obtenerCitas).mockResolvedValue([])
    render(
      <MemoryRouter>
        <Panel />
      </MemoryRouter>
    )
    await waitFor(() => expect(obtenerCitas).toHaveBeenCalledWith('t', { fecha: '2026-10-04' }))
  })
})
