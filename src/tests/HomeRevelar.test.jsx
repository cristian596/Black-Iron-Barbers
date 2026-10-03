import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home'
import * as api from '../services/api'
import { reiniciarCacheBarberos } from '../hooks/useCantidadBarberos'

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

// jsdom no calcula layout: todo lo que no es el hero queda por debajo del viewport
let rectOriginal
beforeEach(() => {
  observers.length = 0
  reiniciarCacheBarberos()
  vi.stubGlobal('IntersectionObserver', IntersectionObserverFalso)
  rectOriginal = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    return { top: 2000, bottom: 2100, left: 0, right: 0, width: 0, height: 0 }
  }
  vi.mocked(api.obtenerBarberos).mockResolvedValue([
    { id: 1, nombre: 'Andrés', cargo: 'Barbero', especialidad: 'Fade', foto: '/a.jpg' },
    { id: 2, nombre: 'Luis', cargo: 'Barbero', especialidad: 'Barba', foto: '/b.jpg' },
  ])
  vi.mocked(api.obtenerServicios).mockResolvedValue(
    Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      nombre: `Servicio ${i + 1}`,
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
      <Home />
    </MemoryRouter>
  )
  await screen.findByText('Servicio 6')
  return vista
}

const ocultos = (raiz) => raiz.querySelectorAll('.opacity-0')

describe('Home con Revelar', () => {
  it('el hero no se oculta ni lo anima Revelar', async () => {
    const { container } = await montar()
    let hero = screen.getByRole('heading', { level: 1 })
    while (hero.parentElement !== container) hero = hero.parentElement

    expect(hero.closest('.opacity-0')).toBeNull()
    expect(ocultos(hero)).toHaveLength(0)
    expect(hero.querySelector('[class*="translate-y-6"]')).toBeNull()
  })

  it('las secciones de debajo quedan ocultas, sin ocultarlas a lectores de pantalla', async () => {
    await montar()

    const titulos = ['Reserva a tu manera', 'NUESTRA CARTA DE SERVICIOS', 'Nuestro Equipo']
    titulos.forEach((nombre) => {
      const titulo = screen.getByRole('heading', { name: nombre })
      expect(titulo).toHaveClass('opacity-0')
      expect(titulo).not.toHaveAttribute('aria-hidden')
    })
    expect(screen.getByRole('button', { name: /Por servicio/ })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Categorías de servicios' })).toHaveClass('opacity-0')
  })

  it('todos los Revelar comparten un solo observer, aparte del de Estadisticas y Testimonios', async () => {
    const { container } = await montar()
    const revelar = observers.filter((o) => o.opciones.rootMargin === '0px 0px -8% 0px')

    expect(revelar).toHaveLength(1)
    // Cada Revelar lleva duration-600 (los testimonios usan duration-700)
    expect(revelar[0].observe).toHaveBeenCalledTimes(container.querySelectorAll('.duration-600').length)
  })

  it('las tarjetas de servicios entran escalonadas, con tope', async () => {
    await montar()
    const tarjetas = screen.getAllByRole('button', { name: 'Seleccionar' })
    const retrasos = tarjetas.map((b) => b.closest('.opacity-0').style.transitionDelay)

    // Sin retardo no se escribe style; el retardo se reinicia cada 4 tarjetas
    expect(retrasos).toEqual(['', '80ms', '160ms', '240ms', '', '80ms'])
  })

  it('al llegar a pantalla se revelan sin conservar transform y no se repiten', async () => {
    await montar()
    const titulo = screen.getByRole('heading', { name: 'Nuestro Equipo' })
    const observer = observers.find((o) => o.opciones.rootMargin)

    act(() => observer.disparar(true, [titulo]))
    expect(titulo).toHaveClass('opacity-100', 'translate-none')
    expect(titulo).not.toHaveClass('opacity-0')
    expect(titulo.className).not.toMatch(/(^|\s)-?translate-[xy]-\d/)

    act(() => observer.disparar(false, [titulo]))
    act(() => observer.disparar(true, [titulo]))
    expect(titulo).toHaveClass('opacity-100')
  })

  it('el carrusel de barberos se anima como contenedor completo, no por slide', async () => {
    const { container } = await montar()
    const carrusel = container.querySelector('.swiper')

    expect(carrusel.closest('.opacity-0')).not.toBeNull()
    container.querySelectorAll('.swiper-slide').forEach((slide) => {
      expect(slide.className).not.toMatch(/opacity-0|translate-/)
    })
  })

  it('las variantes laterales llevan el contenedor con overflow-x-clip', async () => {
    const { container } = await montar()
    const lateral = container.querySelectorAll('.-translate-x-4, .translate-x-4')

    expect(lateral.length).toBeGreaterThan(0)
    lateral.forEach((el) => {
      let a = el.parentElement
      while (a && !a.classList.contains('overflow-x-clip')) a = a.parentElement
      expect(a).not.toBeNull()
    })
  })
})
