import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProveedorCarrito, useCarrito } from '../context/CarritoContext'
import * as api from '../services/api'
import { SERVICIOS_API } from './fixturesServicios'

vi.mock('../services/api')

const CLAVE = 'seleccion-servicios'
const guardado = () => JSON.parse(sessionStorage.getItem(CLAVE))

const montar = () => renderHook(() => useCarrito(), { wrapper: ProveedorCarrito })
const [CLASICO, FADE, PREMIUM, BARBA] = SERVICIOS_API

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(api.obtenerServicios).mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('CarritoContext: agregar, quitar y vaciar', () => {
  it('agrega en orden, sin repetir, y expone los datos de cada servicio', () => {
    const { result } = montar()

    act(() => void result.current.agregar(FADE))
    act(() => void result.current.agregar(CLASICO))
    act(() => void result.current.agregar(FADE)) // repetido: no cambia

    expect(result.current.ids).toEqual([2, 1])
    expect(result.current.seleccion.map((s) => s.nombre)).toEqual(['Corte degradado (Fade)', 'Corte clásico'])
  })

  it('quita uno y vacía todo', () => {
    const { result } = montar()
    act(() => {
      result.current.agregar(CLASICO)
      result.current.agregar(FADE)
    })

    act(() => result.current.quitar(1))
    expect(result.current.ids).toEqual([2])

    act(() => result.current.vaciar())
    expect(result.current.ids).toEqual([])
    expect(sessionStorage.getItem(CLAVE)).toBeNull()
  })

  it('alternar agrega y quita', () => {
    const { result } = montar()
    act(() => void result.current.alternar(CLASICO))
    expect(result.current.ids).toEqual([1])
    act(() => void result.current.alternar(CLASICO))
    expect(result.current.ids).toEqual([])
  })

  it('el límite es 3: el cuarto se rechaza con el motivo y no se agrega', () => {
    const { result } = montar()
    act(() => {
      result.current.agregar(CLASICO)
      result.current.agregar(FADE)
      result.current.agregar(PREMIUM)
    })

    let respuesta
    act(() => {
      respuesta = result.current.agregar(BARBA)
    })

    expect(respuesta).toMatchObject({ permitido: false, motivo: 'maximo', mensaje: 'Máximo 3 servicios por reserva' })
    expect(result.current.ids).toEqual([1, 2, 3])
  })

  it('dos agregados en el mismo instante respetan el límite (no deciden con estado viejo)', () => {
    const { result } = montar()
    act(() => {
      result.current.agregar(CLASICO)
      result.current.agregar(FADE)
      result.current.agregar(PREMIUM)
      result.current.agregar(BARBA)
    })
    expect(result.current.ids).toHaveLength(3)
  })

  it('un combo que pasaría de 240 min se rechaza; un servicio individual de 300 min se acepta', () => {
    const largo = { ...CLASICO, id: 50, duracion_min: 300 }
    const { result } = montar()

    let primero
    act(() => {
      primero = result.current.agregar(largo)
    })
    expect(primero.permitido).toBe(true)

    let segundo
    act(() => {
      segundo = result.current.agregar({ ...FADE, duracion_min: 20 })
    })
    expect(segundo).toMatchObject({ permitido: false, motivo: 'duracion' })
    expect(result.current.ids).toEqual([50])
  })
})

describe('CarritoContext: persistencia', () => {
  it('guarda los ids en sessionStorage y los recupera al montar de nuevo', () => {
    const primera = montar()
    act(() => {
      primera.result.current.agregar(FADE)
      primera.result.current.agregar(CLASICO)
    })
    expect(guardado()).toEqual([2, 1])
    primera.unmount()

    const segunda = montar()
    expect(segunda.result.current.ids).toEqual([2, 1])
    // Solo se conoce el id hasta que la carta sincroniza con el catálogo
    expect(segunda.result.current.seleccion).toEqual([])
    act(() => segunda.result.current.sincronizar(SERVICIOS_API))
    expect(segunda.result.current.seleccion.map((s) => s.id)).toEqual([2, 1])
  })

  it.each([
    ['texto que no es JSON', 'esto no es json'],
    ['un objeto', '{"a":1}'],
    ['null', 'null'],
    ['ids no válidos y repetidos, y más de 3', '[1,"2",1,-4,2.5,null,2,3,4,5]'],
  ])('un valor guardado inválido (%s) se descarta sin romper', (_n, crudo) => {
    sessionStorage.setItem(CLAVE, crudo)
    const { result } = montar()
    expect(Array.isArray(result.current.ids)).toBe(true)
    expect(result.current.ids.length).toBeLessThanOrEqual(3)
    expect(new Set(result.current.ids).size).toBe(result.current.ids.length)
    result.current.ids.forEach((id) => expect(Number.isInteger(id) && id > 0).toBe(true))
  })

  it('de la lista inválida solo conserva los enteros positivos sin repetir, hasta 3', () => {
    sessionStorage.setItem(CLAVE, '[1,"2",1,-4,2.5,null,2,3,4,5]')
    expect(montar().result.current.ids).toEqual([1, 2, 3])
  })

  it('sin sessionStorage (lanza al leer y al escribir) la selección funciona igual en memoria', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage bloqueado')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage bloqueado')
    })

    const { result } = montar()
    expect(result.current.ids).toEqual([])

    act(() => void result.current.agregar(CLASICO))
    act(() => void result.current.agregar(FADE))
    expect(result.current.ids).toEqual([1, 2])
    act(() => result.current.vaciar())
    expect(result.current.ids).toEqual([])
  })
})

describe('CarritoContext: validación contra el catálogo', () => {
  it('sincronizar quita los ids inactivos o inexistentes y deja un aviso', () => {
    sessionStorage.setItem(CLAVE, JSON.stringify([1, 99]))
    const { result } = montar()

    act(() => result.current.sincronizar(SERVICIOS_API))

    expect(result.current.ids).toEqual([1])
    expect(result.current.aviso).toMatch(/ya no está disponible/)
    expect(guardado()).toEqual([1])
  })

  it('si conoce el nombre del servicio que se quitó, lo nombra en el aviso', () => {
    const { result } = montar()
    act(() => {
      result.current.agregar(CLASICO)
      result.current.agregar(FADE)
    })

    act(() => result.current.sincronizar(SERVICIOS_API.filter((s) => s.id !== 2)))

    expect(result.current.ids).toEqual([1])
    expect(result.current.aviso).toContain('"Corte degradado (Fade)" ya no está disponible')
  })

  it('si no queda ninguno, la selección queda vacía y el aviso explica por qué', () => {
    sessionStorage.setItem(CLAVE, JSON.stringify([98, 99]))
    const { result } = montar()
    act(() => result.current.sincronizar(SERVICIOS_API))
    expect(result.current.ids).toEqual([])
    expect(result.current.aviso).toMatch(/2 servicios de tu selección ya no están disponibles/)
    expect(sessionStorage.getItem(CLAVE)).toBeNull()
  })

  it('si todo sigue activo no hay aviso', () => {
    sessionStorage.setItem(CLAVE, JSON.stringify([1, 2]))
    const { result } = montar()
    act(() => result.current.sincronizar(SERVICIOS_API))
    expect(result.current.ids).toEqual([1, 2])
    expect(result.current.aviso).toBe('')
  })

  it('el aviso se limpia al cambiar la selección o al descartarlo', () => {
    sessionStorage.setItem(CLAVE, JSON.stringify([1, 99]))
    const { result } = montar()
    act(() => result.current.sincronizar(SERVICIOS_API))
    expect(result.current.aviso).not.toBe('')

    act(() => result.current.descartarAviso())
    expect(result.current.aviso).toBe('')

    sessionStorage.setItem(CLAVE, JSON.stringify([1]))
    act(() => result.current.sincronizar(SERVICIOS_API.filter((s) => s.id !== 1)))
    expect(result.current.aviso).not.toBe('')
    act(() => void result.current.agregar(FADE))
    expect(result.current.aviso).toBe('')
  })

  it('revalidar vuelve a pedir el catálogo y quita lo que ya no está', async () => {
    const { result } = montar()
    act(() => {
      result.current.agregar(CLASICO)
      result.current.agregar(FADE)
    })
    vi.mocked(api.obtenerServicios).mockResolvedValue(SERVICIOS_API.filter((s) => s.id !== 1))

    await act(async () => {
      await result.current.revalidar()
    })

    expect(api.obtenerServicios).toHaveBeenCalledTimes(1)
    expect(result.current.ids).toEqual([2])
    expect(result.current.aviso).toContain('"Corte clásico"')
  })

  it('si revalidar falla (sin conexión) conserva la selección y no lanza', async () => {
    const { result } = montar()
    act(() => void result.current.agregar(CLASICO))
    vi.mocked(api.obtenerServicios).mockRejectedValue(new Error('sin red'))

    await act(async () => {
      await result.current.revalidar()
    })

    expect(result.current.ids).toEqual([1])
    expect(result.current.aviso).toBe('')
  })
})

describe('useCarrito', () => {
  it('fuera de <ProveedorCarrito> lanza un error claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useCarrito())).toThrow(/ProveedorCarrito/)
  })
})
