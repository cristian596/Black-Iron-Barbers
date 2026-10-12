import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Cortes from '../pages/Cortes'
import * as api from '../services/api'
import { ProveedorCarrito } from '../context/CarritoContext'

vi.mock('../services/api')

const observers = []
class IntersectionObserverFalso {
  constructor(callback, opciones) {
    this.callback = callback
    this.opciones = opciones
    this.elementos = []
    this.observe = vi.fn((elemento) => this.elementos.push(elemento))
    this.unobserve = vi.fn()
    this.disconnect = vi.fn()
    observers.push(this)
  }
  disparar(isIntersecting, objetivos = this.elementos) {
    this.callback(objetivos.map((target) => ({ target, isIntersecting })))
  }
}

// jsdom no calcula layout: título y filtros están en la primera pantalla; las
// tarjetas, por debajo del viewport
let rectOriginal
beforeEach(() => {
  sessionStorage.clear()
  observers.length = 0
  vi.stubGlobal('IntersectionObserver', IntersectionObserverFalso)
  rectOriginal = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    const enPrimeraPantalla = this.tagName === 'H2' || this.getAttribute('role') === 'group'
    return { top: enPrimeraPantalla ? 120 : 2000, bottom: 0, left: 0, right: 0, width: 0, height: 0 }
  }
  vi.mocked(api.obtenerServicios).mockResolvedValue(
    Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      nombre: `Servicio ${i + 1}`,
      descripcion: `Descripción ${i + 1}`,
      tipo: 'original',
      categoria: { id: 1, nombre: 'Cortes', slug: 'cortes' },
      duracion_min: 30,
      precio: 25000,
    }))
  )
})

afterEach(() => {
  Element.prototype.getBoundingClientRect = rectOriginal
  vi.unstubAllGlobals()
})

const montar = async () => {
  const vista = render(
    <MemoryRouter>
      <ProveedorCarrito>
        <Cortes />
      </ProveedorCarrito>
    </MemoryRouter>
  )
  await screen.findByText('Servicio 6')
  return vista
}

const contenedorDe = (boton) => boton.closest('.duration-600')

describe('Cortes con Revelar', () => {
  it('el título y los filtros de la primera pantalla no se ocultan ni se animan', async () => {
    await montar()
    const titulo = screen.getByRole('heading', { name: 'NUESTRA CARTA DE SERVICIOS' })
    const filtros = screen.getByRole('group', { name: 'Filtrar servicios' })

    ;[titulo, filtros].forEach((el) => {
      expect(el).toHaveClass('opacity-100', 'translate-none')
      expect(el).not.toHaveClass('opacity-0')
      expect(el.className).not.toMatch(/transition|duration/)
    })
  })

  it('las tarjetas fuera de la primera pantalla quedan ocultas y entran escalonadas', async () => {
    await montar()
    const tarjetas = screen.getAllByRole('button', { name: 'Agregar a mi selección' }).map(contenedorDe)

    tarjetas.forEach((t) => expect(t).toHaveClass('opacity-0'))
    expect(tarjetas.map((t) => t.style.transitionDelay)).toEqual(['', '80ms', '160ms', '', '80ms', '160ms'])
    // Un único observer compartido para las seis tarjetas
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledTimes(6)

    act(() => observers[0].disparar(true, [tarjetas[0]]))
    expect(tarjetas[0]).toHaveClass('opacity-100', 'translate-none')
    expect(tarjetas[1]).toHaveClass('opacity-0')
  })

  it('el h1 accesible se mantiene y sigue siendo único', async () => {
    await montar()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('al volver a elegir una categoría, las tarjetas que se mantienen no vuelven a animarse', async () => {
    await montar()
    const primera = contenedorDe(screen.getAllByRole('button', { name: 'Agregar a mi selección' })[0])
    act(() => observers[0].disparar(true, [primera]))
    expect(primera).toHaveClass('opacity-100')

    // "Todos" vuelve a seleccionarse: la lista no cambia y no se remonta nada
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría' })).getByRole('button', { name: 'Todos' }))
    expect(contenedorDe(screen.getAllByRole('button', { name: 'Agregar a mi selección' })[0])).toBe(primera)
    expect(primera).toHaveClass('opacity-100')
    expect(primera).not.toHaveClass('opacity-0')
  })
})
