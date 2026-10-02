import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Hero from '../components/sections/Hero'
import * as api from '../services/api'

vi.mock('../services/api')

const renderHero = () =>
  render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>
  )

const datos = () => screen.getByRole('list', { name: 'Datos de la barbería' })

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
    expect(datos()).toHaveTextContent('Todos los días y festivos · 9 a. m. – 6 p. m.')
    expect(datos()).toHaveTextContent('Cll 22 #1 A 69 sur, Prado Cartagenita')
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

    await waitFor(() => expect(api.obtenerBarberos).toHaveBeenCalled())
    expect(datos()).not.toHaveTextContent(/barbero/i)
    expect(datos()).toHaveTextContent('9 a. m. – 6 p. m.')
    expect(datos().querySelectorAll('li')).toHaveLength(2)
  })

  it('oculta el dato si la API devuelve 0 barberos', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([])
    renderHero()

    await waitFor(() => expect(api.obtenerBarberos).toHaveBeenCalled())
    expect(datos()).not.toHaveTextContent(/barbero/i)
  })
})
