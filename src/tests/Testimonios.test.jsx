import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import Testimonios from '../components/sections/Testimonios'
import { TESTIMONIOS } from '../data/testimonios'

const observers = []
class IntersectionObserverFalso {
  constructor(callback, opciones) {
    this.callback = callback
    this.opciones = opciones
    this.observe = vi.fn()
    this.disconnect = vi.fn()
    observers.push(this)
  }
}

describe('Testimonios', () => {
  it('renderiza una reseña por cada elemento de testimonios.js', () => {
    render(<Testimonios />)

    expect(screen.getAllByRole('figure')).toHaveLength(TESTIMONIOS.length)
    TESTIMONIOS.forEach(({ nombre, comentario }) => {
      expect(screen.getByText(nombre)).toBeInTheDocument()
      expect(screen.getByText(`“${comentario}”`)).toBeInTheDocument()
    })
  })

  it('cada estrella tiene texto accesible y la sección su título', () => {
    render(<Testimonios />)

    expect(screen.getAllByText('5 de 5 estrellas').length).toBeGreaterThan(0)
    expect(screen.getByText('4 de 5 estrellas')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Lo que dicen nuestros clientes' })).toBeInTheDocument()
  })

  it('usa blockquote y figcaption dentro de cada figure', () => {
    render(<Testimonios />)

    screen.getAllByRole('figure').forEach((figura) => {
      expect(figura.querySelector('blockquote')).not.toBeNull()
      expect(figura.querySelector('figcaption')).not.toBeNull()
    })
  })

  it('no menciona otra ciudad que la del negocio', () => {
    render(<Testimonios />)
    expect(screen.queryByText(/Bogotá/)).not.toBeInTheDocument()
  })
})

describe('Testimonios: animación de entrada', () => {
  beforeEach(() => {
    observers.length = 0
    vi.stubGlobal('IntersectionObserver', IntersectionObserverFalso)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('las tarjetas aparecen con fade al entrar en pantalla, una sola vez', () => {
    render(<Testimonios />)
    const tarjetas = screen.getAllByRole('figure')
    tarjetas.forEach((t) => expect(t).toHaveClass('opacity-0'))

    act(() => observers.at(-1).callback([{ isIntersecting: true }]))
    tarjetas.forEach((t) => {
      expect(t).toHaveClass('opacity-100')
      expect(t).not.toHaveClass('opacity-0')
    })
    expect(observers.at(-1).disconnect).toHaveBeenCalled()
  })

  it('escalona 60 ms por tarjeta', () => {
    render(<Testimonios />)
    const retrasos = screen.getAllByRole('figure').map((t) => t.style.transitionDelay)
    expect(retrasos).toEqual(['0ms', '60ms', '120ms', '180ms'])
  })

  it('respeta prefers-reduced-motion: opacidad final y sin transición', () => {
    render(<Testimonios />)
    screen.getAllByRole('figure').forEach((t) => {
      expect(t).toHaveClass('motion-reduce:opacity-100')
      expect(t).toHaveClass('motion-reduce:transition-none')
    })
  })

  it('limpia el observer al desmontar', () => {
    const { unmount } = render(<Testimonios />)
    const observer = observers.at(-1)
    unmount()
    expect(observer.disconnect).toHaveBeenCalled()
  })
})
