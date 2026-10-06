import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import NuestrosColaboradores from '../components/sections/NuestrosColaboradores'
import * as api from '../services/api'
import { cargosDelEquipo, enlaceReserva, filtrarPorCargo } from '../utils/equipo'

vi.mock('../services/api')

const EQUIPO = [
  { id: 1, nombre: 'Boby', cargo: 'Barbero Senior', especialidad: 'Fade y Barba', foto: '/Barberos/boby.jpg' },
  { id: 37, nombre: 'Camila', cargo: 'Asesora de Imagen', especialidad: 'Asesoria', foto: '/Asesores/camila_asesora.jpg' },
  { id: 36, nombre: 'Camilo', cargo: 'Barbero Profesional', especialidad: 'Corte clasico', foto: null },
  { id: 2, nombre: 'Dani', cargo: 'Barbero Profesional', especialidad: 'Fade', foto: '/Barberos/dani.jpg' },
]

const montar = () =>
  render(
    <MemoryRouter>
      <NuestrosColaboradores />
    </MemoryRouter>
  )

const tarjetas = (raiz) => within(raiz.querySelector('#equipo ul')).getAllByRole('listitem')

beforeEach(() => {
  vi.mocked(api.obtenerBarberos).mockResolvedValue(EQUIPO)
})
afterEach(() => vi.unstubAllGlobals())

describe('utils/equipo', () => {
  it('cargosDelEquipo cuenta cargos reales, ordena por cantidad y luego alfabético, e ignora los vacíos', () => {
    expect(cargosDelEquipo([...EQUIPO, { id: 9, nombre: 'X', cargo: '  ' }, { id: 10, nombre: 'Y', cargo: null }])).toEqual([
      { cargo: 'Barbero Profesional', total: 2 },
      { cargo: 'Asesora de Imagen', total: 1 },
      { cargo: 'Barbero Senior', total: 1 },
    ])
  })

  it('filtrarPorCargo y enlaceReserva', () => {
    expect(filtrarPorCargo(EQUIPO, null)).toHaveLength(4)
    expect(filtrarPorCargo(EQUIPO, 'Barbero Profesional').map((b) => b.id)).toEqual([36, 2])
    expect(enlaceReserva({ id: 7 })).toBe('/reservar-corte?barbero=7')
    expect(enlaceReserva(null)).toBe('/reservar-corte')
  })
})

describe('Nuestro Equipo', () => {
  it('muestra todos los barberos activos como lista, sin carrusel, con h2 y un h3 por nombre', async () => {
    const { container } = montar()
    await screen.findByRole('heading', { level: 3, name: 'Boby' })

    expect(container.querySelector('.swiper')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Nuestro Equipo' })).toBeInTheDocument()
    expect(tarjetas(container)).toHaveLength(4)
    // Orden alfabético en español
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Boby', 'Camila', 'Camilo', 'Dani'])
  })

  it('cada botón reserva con el barbero correcto y el cierre usa "cualquier barbero"', async () => {
    montar()
    await screen.findByText('Boby')

    expect(screen.getByRole('link', { name: 'Reservar con Camila' })).toHaveAttribute('href', '/reservar-corte?barbero=37')
    expect(screen.getByRole('link', { name: 'Reservar con Camilo' })).toHaveAttribute('href', '/reservar-corte?barbero=36')
    expect(screen.getByRole('link', { name: 'Reservar con Boby' })).toHaveAttribute('href', '/reservar-corte?barbero=1')
    expect(screen.getByText('¿No sabes con quién?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reservar con cualquier barbero' })).toHaveAttribute('href', '/reservar-corte')
  })

  it('alt con nombre y cargo; sin foto o con imagen rota, avatar de iniciales premium', async () => {
    montar()
    await screen.findByText('Boby')

    expect(screen.getByAltText('Foto de Camila, Asesora de Imagen en Black Iron Barbers')).toHaveAttribute('src', '/Asesores/camila_asesora.jpg')
    const sinFoto = screen.getByRole('img', { name: 'Avatar de Camilo' })
    expect(sinFoto).toHaveTextContent('C')
    expect(sinFoto.querySelector('.font-cinzel')).not.toBeNull()

    fireEvent.error(screen.getByAltText(/foto de dani/i))
    expect(screen.getByRole('img', { name: 'Avatar de Dani' })).toHaveTextContent('D')
    expect(screen.queryByAltText(/foto de dani/i)).toBeNull()
  })

  it('las fotos llevan loading lazy, width y height', async () => {
    montar()
    await screen.findByText('Boby')
    const foto = screen.getByAltText(/foto de boby/i)
    expect(foto).toHaveAttribute('loading', 'lazy')
    expect(foto).toHaveAttribute('width', '640')
    expect(foto).toHaveAttribute('height', '800')
  })

  it('filtro por cargo: chips con conteo y aria-pressed; filtra y vuelve a Todos', async () => {
    const user = userEvent.setup()
    const { container } = montar()
    await screen.findByText('Boby')

    const grupo = screen.getByRole('group', { name: 'Filtrar por cargo' })
    const todos = within(grupo).getByRole('button', { name: /^Todos\s*4$/ })
    const profesional = within(grupo).getByRole('button', { name: /^Barbero Profesional\s*2$/ })
    expect(within(grupo).getAllByRole('button')).toHaveLength(4)
    expect(todos).toHaveAttribute('aria-pressed', 'true')

    await user.click(profesional)
    expect(profesional).toHaveAttribute('aria-pressed', 'true')
    expect(todos).toHaveAttribute('aria-pressed', 'false')
    expect(tarjetas(container)).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: 'Boby' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Dani' })).toBeInTheDocument()

    await user.click(todos)
    expect(tarjetas(container)).toHaveLength(4)
  })

  it('con un solo cargo distinto no aparece el filtro', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue(EQUIPO.filter((b) => b.cargo === 'Barbero Profesional'))
    montar()
    await screen.findByText('Dani')
    expect(screen.queryByRole('group', { name: 'Filtrar por cargo' })).toBeNull()
  })

  it('pocos barberos: la lista se centra y no se estira', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue(EQUIPO.slice(0, 1))
    const { container } = montar()
    await screen.findByText('Boby')
    expect(container.querySelector('#equipo ul')).toHaveClass('justify-center', 'flex-wrap')
    expect(tarjetas(container)).toHaveLength(1)
  })

  it('nombres largos llevan wrap-anywhere', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([
      { id: 5, nombre: 'Nombremuylargosinespaciosquedesborda', cargo: 'Cargo', especialidad: 'x'.repeat(80), foto: null },
    ])
    montar()
    const h3 = await screen.findByRole('heading', { level: 3 })
    expect(h3).toHaveClass('wrap-anywhere')
  })

  it('mientras carga muestra esqueletos con la forma de la tarjeta', async () => {
    let resolver
    vi.mocked(api.obtenerBarberos).mockReturnValue(new Promise((r) => (resolver = r)))
    const { container } = montar()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando equipo')
    expect(container.querySelectorAll('#equipo ul li')).toHaveLength(8)
    expect(container.querySelector('#equipo ul .aspect-4\\/5')).not.toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    resolver(EQUIPO)
    await screen.findByText('Boby')
  })

  it('error: mensaje con Reintentar que vuelve a pedir el equipo', async () => {
    const user = userEvent.setup()
    vi.mocked(api.obtenerBarberos).mockRejectedValueOnce(new Error('No se pudo cargar el equipo'))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el equipo')

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Boby' })).toBeInTheDocument()
    expect(api.obtenerBarberos).toHaveBeenCalledTimes(2)
  })

  it('vacío: mensaje claro y sin botón de reserva', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([])
    montar()
    expect(await screen.findByText('Pronto presentaremos a nuestro equipo.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('con prefers-reduced-motion las tarjetas no quedan ocultas', async () => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }))
    const { container } = montar()
    await screen.findByText('Boby')
    expect(container.querySelectorAll('.opacity-0')).toHaveLength(0)
  })
})
