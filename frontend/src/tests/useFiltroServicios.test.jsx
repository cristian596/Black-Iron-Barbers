import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFiltroServicios } from '../hooks/useFiltroServicios'
import { SERVICIOS_API } from './fixturesServicios'

const nombres = (resultado) => resultado.current.visibles.map((s) => s.nombre)

describe('useFiltroServicios', () => {
  it('por defecto muestra la primera categoría (Cortes)', () => {
    const { result } = renderHook(() => useFiltroServicios(SERVICIOS_API))
    expect(result.current.categoriaActiva).toBe('cortes')
    expect(result.current.visibles.every((s) => s.categoria.slug === 'cortes')).toBe(true)
  })

  it('con un servicio ya seleccionado, la categoría activa es la de ese servicio', () => {
    const { result } = renderHook(() => useFiltroServicios(SERVICIOS_API, { servicioId: 5 }))
    expect(result.current.categoriaActiva).toBe('barba')
  })

  it('si el servicio seleccionado no está en la lista, cae en la primera categoría', () => {
    const { result } = renderHook(() => useFiltroServicios(SERVICIOS_API, { servicioId: 999 }))
    expect(result.current.categoriaActiva).toBe('cortes')
  })

  it('con la lista vacía no falla y no hay categorías', () => {
    const { result } = renderHook(() => useFiltroServicios([]))
    expect(result.current.visibles).toEqual([])
    expect(result.current.categorias).toEqual([])
    expect(result.current.grupos).toEqual([])
  })

  it('elegir una categoría, "Todos" o un tipo cambia lo visible', () => {
    const { result } = renderHook(() => useFiltroServicios(SERVICIOS_API))

    act(() => result.current.setCategoria('barba'))
    expect(nombres(result)).toEqual(['Perfilado de barba', 'Ritual VIP de barba'])

    act(() => result.current.setCategoria('todas'))
    expect(result.current.visibles).toHaveLength(6)
    expect(result.current.grupos).toHaveLength(3)

    act(() => result.current.setTipo('vip'))
    expect(result.current.visibles.map((s) => s.id)).toEqual([3, 5])
  })

  it('el texto del buscador recorre todas las categorías y, al borrarlo, vuelve la elegida', () => {
    const { result } = renderHook(() => useFiltroServicios(SERVICIOS_API))
    act(() => result.current.setCategoria('faciales'))

    act(() => result.current.setBusqueda('barba'))
    expect(result.current.buscando).toBe(true)
    expect(nombres(result)).toEqual(['Perfilado de barba', 'Ritual VIP de barba'])

    act(() => result.current.setBusqueda(''))
    expect(result.current.buscando).toBe(false)
    expect(result.current.categoriaActiva).toBe('faciales')
    expect(nombres(result)).toEqual(['Limpieza facial básica'])
  })

  it('limpiar restablece búsqueda, tipo y categoría por defecto', () => {
    const { result } = renderHook(() => useFiltroServicios(SERVICIOS_API))
    act(() => {
      result.current.setCategoria('barba')
      result.current.setTipo('elite')
      result.current.setBusqueda('xyz')
    })
    expect(result.current.visibles).toEqual([])

    act(() => result.current.limpiar())
    expect(result.current.busqueda).toBe('')
    expect(result.current.tipo).toBe('todos')
    expect(result.current.categoriaActiva).toBe('cortes')
    expect(result.current.visibles).toHaveLength(3)
  })

  it('si la categoría elegida desaparece de la lista (recarga), vuelve a la de por defecto', () => {
    const { result, rerender } = renderHook(({ lista }) => useFiltroServicios(lista), {
      initialProps: { lista: SERVICIOS_API },
    })
    act(() => result.current.setCategoria('faciales'))
    expect(result.current.categoriaActiva).toBe('faciales')

    rerender({ lista: SERVICIOS_API.filter((s) => s.categoria.slug !== 'faciales') })
    expect(result.current.categoriaActiva).toBe('cortes')
  })
})
