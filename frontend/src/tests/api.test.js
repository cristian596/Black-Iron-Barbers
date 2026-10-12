import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { construirQuery, obtenerServicios } from '../services/api'

describe('construirQuery', () => {
  it('sin filtros devuelve cadena vacía', () => {
    expect(construirQuery()).toBe('')
    expect(construirQuery({})).toBe('')
  })

  it('arma la query con los filtros presentes', () => {
    expect(construirQuery({ categoria: 'barba', tipo: 'vip' })).toBe('?categoria=barba&tipo=vip')
  })

  it('ignora valores vacíos, solo espacios, null y undefined', () => {
    expect(construirQuery({ categoria: '', tipo: undefined, q: '   ', ordenar: null })).toBe('')
    expect(construirQuery({ tipo: 'elite', q: '' })).toBe('?tipo=elite')
  })

  it('codifica tildes, espacios y % para que lleguen literales al servidor', () => {
    expect(construirQuery({ q: 'clásico' })).toBe('?q=cl%C3%A1sico')
    expect(construirQuery({ q: '100%' })).toBe('?q=100%25')
    expect(construirQuery({ q: 'corte + barba' })).toBe('?q=corte+%2B+barba')
  })
})

describe('obtenerServicios y errores de la API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const respuesta = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo })

  it('sin argumentos pide /servicios sin query (compatible con las llamadas anteriores)', async () => {
    fetch.mockResolvedValue(respuesta(200, []))
    await obtenerServicios()
    expect(fetch.mock.calls[0][0]).toMatch(/\/servicios$/)
  })

  it('con filtros los añade a la URL', async () => {
    fetch.mockResolvedValue(respuesta(200, []))
    await obtenerServicios({ categoria: 'cortes', tipo: 'elite' })
    expect(fetch.mock.calls[0][0]).toMatch(/\/servicios\?categoria=cortes&tipo=elite$/)
  })

  it('propaga error.codigo y error.status cuando el back-end los envía', async () => {
    fetch.mockResolvedValue(
      respuesta(400, { error: 'El servicio seleccionado no existe o no está disponible', codigo: 'SERVICIO_NO_DISPONIBLE' })
    )
    await expect(obtenerServicios()).rejects.toMatchObject({
      message: 'El servicio seleccionado no existe o no está disponible',
      status: 400,
      codigo: 'SERVICIO_NO_DISPONIBLE',
    })
  })

  it('un error sin codigo no inventa uno', async () => {
    fetch.mockResolvedValue(respuesta(400, { error: 'Otro problema' }))
    const error = await obtenerServicios().catch((e) => e)
    expect(error.codigo).toBeUndefined()
    expect(error.status).toBe(400)
  })
})
