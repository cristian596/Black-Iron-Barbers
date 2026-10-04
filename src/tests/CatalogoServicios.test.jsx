import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CatalogoServicios from '../components/sections/CatalogoServicios'
import * as api from '../services/api'
import { SERVICIOS_API } from './fixturesServicios'

vi.mock('../services/api')

const montar = async () => {
  render(
    <MemoryRouter>
      <CatalogoServicios />
    </MemoryRouter>
  )
  await screen.findByRole('group', { name: 'Filtrar servicios' })
}

const grupoCategorias = () => screen.getByRole('group', { name: 'Categoría' })
const grupoTipos = () => screen.getByRole('group', { name: 'Tipo de servicio' })
const tarjetasVisibles = () => screen.queryAllByRole('button', { name: 'Seleccionar' }).length

beforeEach(() => {
  vi.mocked(api.obtenerServicios).mockResolvedValue(SERVICIOS_API)
})

describe('CatalogoServicios', () => {
  it('pide la lista una sola vez y empieza en la primera categoría (Cortes)', async () => {
    await montar()

    expect(api.obtenerServicios).toHaveBeenCalledTimes(1)
    expect(within(grupoCategorias()).getByRole('button', { name: 'Cortes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Corte clásico' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Perfilado de barba' })).not.toBeInTheDocument()
    expect(tarjetasVisibles()).toBe(3)
  })

  it('muestra categoría, tipo, descripción, duración y precio de la API en cada tarjeta', async () => {
    await montar()

    expect(screen.getByText('Descripción de Corte clásico')).toBeInTheDocument()
    expect(screen.getByText('$18.000')).toBeInTheDocument()
    // Los chips del filtro repiten las etiquetas, así que se comprueba dentro de cada tarjeta
    const tarjeta = (nombre) => screen.getByRole('heading', { name: nombre }).parentElement
    expect(within(tarjeta('Corte clásico')).getByText('Original')).toBeInTheDocument()
    expect(within(tarjeta('Corte degradado (Fade)')).getByText('Élite')).toBeInTheDocument()
    expect(within(tarjeta('Corte premium con asesoría de imagen')).getByText('VIP')).toBeInTheDocument()
    expect(within(tarjeta('Corte clásico')).getByText('Cortes')).toBeInTheDocument()
  })

  it('no ofrece buscador (es un escaparate)', async () => {
    await montar()
    expect(screen.queryByLabelText(/buscar servicio/i)).not.toBeInTheDocument()
  })

  it('cambiar de categoría filtra las tarjetas, sin encabezados', async () => {
    const user = userEvent.setup()
    await montar()

    await user.click(within(grupoCategorias()).getByRole('button', { name: 'Barba' }))

    expect(screen.getByRole('heading', { level: 3, name: 'Perfilado de barba' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Corte clásico' })).not.toBeInTheDocument()
  })

  it('"Todos" muestra todas las categorías con su encabezado h3 y los nombres pasan a h4', async () => {
    const user = userEvent.setup()
    await montar()

    await user.click(within(grupoCategorias()).getByRole('button', { name: 'Todos' }))

    expect(screen.getByRole('heading', { level: 3, name: 'Cortes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Barba' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Faciales' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Limpieza facial básica' })).toBeInTheDocument()
    expect(tarjetasVisibles()).toBe(6)
  })

  it('el filtro de tipo se combina con la categoría', async () => {
    const user = userEvent.setup()
    await montar()

    await user.click(within(grupoTipos()).getByRole('button', { name: /VIP/ }))

    expect(within(grupoTipos()).getByRole('button', { name: /VIP/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Corte premium con asesoría de imagen' })).toBeInTheDocument()
    expect(tarjetasVisibles()).toBe(1)
  })

  it('sin resultados muestra el aviso y "Limpiar filtros" restablece la vista', async () => {
    const user = userEvent.setup()
    await montar()

    await user.click(within(grupoCategorias()).getByRole('button', { name: 'Faciales' }))
    await user.click(within(grupoTipos()).getByRole('button', { name: /VIP/ }))

    expect(screen.getByText(/no encontramos servicios con esos filtros/i)).toBeInTheDocument()
    expect(tarjetasVisibles()).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(screen.queryByText(/no encontramos servicios/i)).not.toBeInTheDocument()
    expect(within(grupoTipos()).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetasVisibles()).toBe(3)
  })

  it('los botones de filtro usan aria-pressed y ya no son pestañas', async () => {
    await montar()

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    within(grupoCategorias())
      .getAllByRole('button')
      .forEach((boton) => expect(boton).toHaveAttribute('aria-pressed'))
  })

  it('muestra el mensaje de error si la API falla', async () => {
    vi.mocked(api.obtenerServicios).mockRejectedValue(new Error('No se pudo conectar con el servidor'))
    render(
      <MemoryRouter>
        <CatalogoServicios />
      </MemoryRouter>
    )

    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar servicios' })).not.toBeInTheDocument()
  })

  it('el error se anuncia como alerta y "Reintentar" vuelve a pedir la lista', async () => {
    const user = userEvent.setup()
    vi.mocked(api.obtenerServicios).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    render(
      <MemoryRouter>
        <CatalogoServicios />
      </MemoryRouter>
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('group', { name: 'Filtrar servicios' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Corte clásico' })).toBeInTheDocument()
    expect(api.obtenerServicios).toHaveBeenCalledTimes(2)
  })

  it('mientras carga muestra un estado accesible (role="status")', async () => {
    render(
      <MemoryRouter>
        <CatalogoServicios />
      </MemoryRouter>
    )

    expect(screen.getByRole('status')).toHaveTextContent(/cargando servicios/i)
    await screen.findByRole('group', { name: 'Filtrar servicios' })
  })
})
