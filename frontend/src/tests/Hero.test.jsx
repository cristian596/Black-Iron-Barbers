import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Hero from '../components/sections/Hero'
import * as api from '../services/api'
import { reiniciarCacheBarberos } from '../hooks/useCantidadBarberos'

vi.mock('../services/api')

beforeEach(() => {
  reiniciarCacheBarberos()
})

const renderHero = () =>
  render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>
  )

const datos = () => screen.getByRole('list', { name: 'Datos de la barbería' })

// Cargando y "sin dato" se ven igual (el dato se omite), así que no hay nada en el DOM que esperar. La señal real
// es que la respuesta simulada ya se resolvió o rechazó y React aplicó el estado resultante: se espera dentro
// de act, que vacía esas actualizaciones, y solo entonces se afirma la ausencia.
const esperarRespuestaBarberos = () =>
  act(async () => {
    await Promise.allSettled(vi.mocked(api.obtenerBarberos).mock.results.map((resultado) => resultado.value))
  })

describe('Hero', () => {
  beforeEach(() => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('tiene un único h1 con la frase y "firma" resaltada, sin comillas rectas', async () => {
    renderHero()
    const titulo = screen.getByRole('heading', { level: 1 })

    expect(titulo).toHaveTextContent('No es solo un corte.Es tu firma.')
    expect(titulo.textContent).not.toContain('"')
    expect(titulo.querySelector('span.text-oro')).toHaveTextContent('firma')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await screen.findByText('3 barberos')
  })

  it('muestra la etiqueta con tilde y la ciudad', async () => {
    renderHero()
    expect(screen.getByText('Barbería de autor · Facatativá')).toBeInTheDocument()
    await screen.findByText('3 barberos')
  })

  it('los dos botones son enlaces a reserva y servicios', async () => {
    renderHero()
    expect(screen.getByRole('link', { name: 'Reservar mi cita' })).toHaveAttribute(
      'href',
      '/reservar-corte'
    )
    expect(screen.getByRole('link', { name: 'Ver servicios' })).toHaveAttribute('href', '/cortes')
    await screen.findByText('3 barberos')
  })

  it('la foto es WebP, con alt descriptivo, prioridad alta y dimensiones', async () => {
    renderHero()
    const foto = screen.getByRole('img')

    expect(foto).toHaveAttribute('src', '/CourtMan/court_14.webp')
    expect(foto.getAttribute('alt').length).toBeGreaterThan(20)
    expect(foto).toHaveAttribute('fetchpriority', 'high')
    expect(foto).toHaveAttribute('width', '736')
    expect(foto).toHaveAttribute('height', '736')
    expect(foto).not.toHaveAttribute('loading', 'lazy')
    await screen.findByText('3 barberos')
  })

  it('las animaciones solo se aplican con motion-safe (respeta prefers-reduced-motion)', async () => {
    const { container } = renderHero()
    await screen.findByText('3 barberos')
    const conAnimacion = container.querySelectorAll('[class*="animate-hero"]')

    expect(conAnimacion.length).toBeGreaterThan(0)
    conAnimacion.forEach((el) => {
      el
        .getAttribute('class')
        .split(/\s+/)
        .filter((c) => c.includes('animate-hero'))
        .forEach((c) => expect(c.startsWith('motion-safe:')).toBe(true))
    })
  })
})

describe('HeroDatos', () => {
  it('muestra el número de barberos de la API junto al horario y la dirección', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
    renderHero()

    await screen.findByText('3 barberos')
    expect(datos()).toHaveTextContent('Todos los días y festivos · 10:00 a. m. – 8:00 p. m.')
    expect(datos()).toHaveTextContent('Calle 22 #1 A 69 sur, Prado Cartagenita')
  })

  it('usa el singular con un solo barbero', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 1 }])
    renderHero()
    expect(await screen.findByText('1 barbero')).toBeInTheDocument()
    expect(screen.queryByText('1 barberos')).not.toBeInTheDocument()
  })

  it('oculta el dato si la API falla, sin inventar cifras', async () => {
    vi.mocked(api.obtenerBarberos).mockRejectedValue(new Error('No se pudo conectar'))
    renderHero()

    await esperarRespuestaBarberos()
    expect(api.obtenerBarberos).toHaveBeenCalledTimes(1)
    expect(datos()).not.toHaveTextContent(/barbero/i)
    expect(datos()).toHaveTextContent('10:00 a. m. – 8:00 p. m.')
    expect(datos().querySelectorAll('li')).toHaveLength(2)
  })

  it('oculta el dato si la API devuelve 0 barberos', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([])
    renderHero()

    await esperarRespuestaBarberos()
    expect(api.obtenerBarberos).toHaveBeenCalledTimes(1)
    expect(datos()).not.toHaveTextContent(/barbero/i)
  })
})
