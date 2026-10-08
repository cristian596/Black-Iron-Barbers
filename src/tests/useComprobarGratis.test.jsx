import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ESPERA_COMPROBAR_MS, useComprobarGratis } from '../hooks/useComprobarGratis'
import * as api from '../services/api'

vi.mock('../services/api')

const VALIDO = { activo: true, correo: 'ana@example.com', telefono: '3001234567' }
const pasar = (ms) => act(() => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(api.comprobarAsesoriaGratis).mockResolvedValue({ disponible: true })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useComprobarGratis', () => {
  it.each([
    ['la reserva no incluye la gratis', { ...VALIDO, activo: false }],
    ['correo inválido', { ...VALIDO, correo: 'ana@' }],
    ['teléfono inválido', { ...VALIDO, telefono: '300123' }],
    ['sin datos', { activo: true, correo: '', telefono: '' }],
  ])('no pregunta si %s', async (_n, props) => {
    const { result } = renderHook(() => useComprobarGratis(props))
    await pasar(ESPERA_COMPROBAR_MS * 3)
    expect(api.comprobarAsesoriaGratis).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('espera antes de preguntar (debounce) y pregunta una sola vez con los datos finales', async () => {
    const { result, rerender } = renderHook((props) => useComprobarGratis(props), { initialProps: VALIDO })
    await pasar(ESPERA_COMPROBAR_MS - 100)
    expect(api.comprobarAsesoriaGratis).not.toHaveBeenCalled()
    rerender({ ...VALIDO, telefono: '3109998888' }) // el cliente corrige el teléfono antes de que venza la espera
    await pasar(ESPERA_COMPROBAR_MS - 100)
    expect(api.comprobarAsesoriaGratis).not.toHaveBeenCalled()
    await pasar(200)
    expect(api.comprobarAsesoriaGratis).toHaveBeenCalledTimes(1)
    expect(api.comprobarAsesoriaGratis).toHaveBeenCalledWith('ana@example.com', '3109998888', expect.any(AbortSignal))
    expect(result.current).toBe(true)
  })

  it('cancela la petición anterior cuando cambian los datos y descarta su respuesta', async () => {
    let resolverPrimera
    vi.mocked(api.comprobarAsesoriaGratis)
      .mockImplementationOnce(
        () =>
          new Promise((resolver) => {
            resolverPrimera = resolver
          })
      )
      .mockResolvedValue({ disponible: true })
    const { result, rerender } = renderHook((props) => useComprobarGratis(props), { initialProps: VALIDO })
    await pasar(ESPERA_COMPROBAR_MS + 10)
    const senalPrimera = vi.mocked(api.comprobarAsesoriaGratis).mock.calls[0][2]
    expect(senalPrimera.aborted).toBe(false)

    rerender({ ...VALIDO, correo: 'otra@example.com' })
    expect(senalPrimera.aborted).toBe(true)
    await act(async () => resolverPrimera({ disponible: false })) // llega tarde, ya no vale
    expect(result.current).toBeNull()

    await pasar(ESPERA_COMPROBAR_MS + 10)
    expect(result.current).toBe(true)
  })

  it('devuelve false cuando ya la usó y vuelve a null si el cliente cambia los datos', async () => {
    vi.mocked(api.comprobarAsesoriaGratis).mockResolvedValue({ disponible: false })
    const { result, rerender } = renderHook((props) => useComprobarGratis(props), { initialProps: VALIDO })
    await pasar(ESPERA_COMPROBAR_MS + 10)
    expect(result.current).toBe(false)
    rerender({ ...VALIDO, correo: 'distinta@example.com' })
    expect(result.current).toBeNull()
  })

  it.each([
    ['error de red', Object.assign(new Error('red'), { red: true })],
    ['429', Object.assign(new Error('límite'), { status: 429 })],
    ['500', Object.assign(new Error('boom'), { status: 500 })],
  ])('si falla (%s) devuelve null: no bloquea', async (_n, error) => {
    vi.mocked(api.comprobarAsesoriaGratis).mockRejectedValue(error)
    const { result } = renderHook(() => useComprobarGratis(VALIDO))
    await pasar(ESPERA_COMPROBAR_MS + 10)
    expect(api.comprobarAsesoriaGratis).toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('al desmontar cancela lo pendiente', async () => {
    const { unmount } = renderHook(() => useComprobarGratis(VALIDO))
    unmount()
    await pasar(ESPERA_COMPROBAR_MS * 2)
    expect(api.comprobarAsesoriaGratis).not.toHaveBeenCalled()
  })
})
