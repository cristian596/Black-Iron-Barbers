import { describe, it, expect } from 'vitest'
import {
  CATEGORIA_TODAS,
  agruparPorCategoria,
  categoriasDe,
  claveCategoria,
  filtrarServicios,
  nombreCategoria,
  normalizarTexto,
} from '../utils/servicios'
import { SERVICIOS_API } from './fixturesServicios'

const SIN_CATEGORIA = { id: 99, nombre: 'Servicio suelto', tipo: 'original', precio: 1000, duracion_min: 10, categoria: null }

describe('normalizarTexto', () => {
  it('quita tildes, pasa a minúsculas y recorta espacios', () => {
    expect(normalizarTexto('  Corte CLÁSICO ')).toBe('corte clasico')
    expect(normalizarTexto('Élite')).toBe('elite')
  })

  it('tolera null y undefined', () => {
    expect(normalizarTexto(null)).toBe('')
    expect(normalizarTexto(undefined)).toBe('')
  })
})

describe('categorías', () => {
  it('categoriasDe conserva el orden en que llegan de la API', () => {
    expect(categoriasDe(SERVICIOS_API).map((c) => c.slug)).toEqual(['cortes', 'barba', 'faciales'])
  })

  it('un servicio sin categoría va a "Otros", siempre al final', () => {
    const lista = [SIN_CATEGORIA, ...SERVICIOS_API]
    expect(categoriasDe(lista).map((c) => c.nombre)).toEqual(['Cortes', 'Barba', 'Faciales', 'Otros'])
    expect(claveCategoria(SIN_CATEGORIA)).toBe('otros')
    expect(nombreCategoria(SIN_CATEGORIA)).toBe('Otros')
  })

  it('agruparPorCategoria reparte cada servicio en su grupo sin perder ninguno', () => {
    const grupos = agruparPorCategoria([...SERVICIOS_API, SIN_CATEGORIA])
    expect(grupos.map((g) => [g.slug, g.servicios.length])).toEqual([
      ['cortes', 3],
      ['barba', 2],
      ['faciales', 1],
      ['otros', 1],
    ])
  })

  it('agruparPorCategoria con lista vacía devuelve []', () => {
    expect(agruparPorCategoria([])).toEqual([])
  })
})

describe('filtrarServicios', () => {
  const nombres = (lista) => lista.map((s) => s.nombre)

  it('sin filtros devuelve todos', () => {
    expect(filtrarServicios(SERVICIOS_API)).toHaveLength(6)
  })

  it('por categoría', () => {
    expect(nombres(filtrarServicios(SERVICIOS_API, { categoria: 'barba' }))).toEqual(['Perfilado de barba', 'Ritual VIP de barba'])
    expect(filtrarServicios(SERVICIOS_API, { categoria: CATEGORIA_TODAS })).toHaveLength(6)
  })

  it('por tipo', () => {
    expect(filtrarServicios(SERVICIOS_API, { tipo: 'vip' }).map((s) => s.id)).toEqual([3, 5])
    expect(filtrarServicios(SERVICIOS_API, { tipo: 'todos' })).toHaveLength(6)
  })

  it('categoría y tipo combinados', () => {
    expect(filtrarServicios(SERVICIOS_API, { categoria: 'cortes', tipo: 'elite' }).map((s) => s.id)).toEqual([2])
    expect(filtrarServicios(SERVICIOS_API, { categoria: 'faciales', tipo: 'vip' })).toEqual([])
  })

  it('la búsqueda ignora tildes y mayúsculas', () => {
    expect(filtrarServicios(SERVICIOS_API, { busqueda: 'CLASICO' }).map((s) => s.id)).toEqual([1])
    expect(filtrarServicios(SERVICIOS_API, { busqueda: 'asesoria' }).map((s) => s.id)).toEqual([3])
  })

  it('con texto de búsqueda se ignora la categoría y recorre todo el catálogo', () => {
    const resultado = filtrarServicios(SERVICIOS_API, { categoria: 'faciales', busqueda: 'barba' })
    expect(resultado.map((s) => s.id)).toEqual([4, 5])
  })

  it('la búsqueda respeta el tipo', () => {
    expect(filtrarServicios(SERVICIOS_API, { busqueda: 'barba', tipo: 'vip' }).map((s) => s.id)).toEqual([5])
  })

  it('una búsqueda solo con espacios no filtra', () => {
    expect(filtrarServicios(SERVICIOS_API, { busqueda: '   ', categoria: 'barba' })).toHaveLength(2)
  })
})
