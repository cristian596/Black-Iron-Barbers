import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import TarjetaServicio from '../components/ui/TarjetaServicio'
import { SERVICIOS_API, SERVICIO_GRATIS } from './fixturesServicios'

const Ubicacion = () => {
  const { pathname, search } = useLocation()
  return <p data-testid="ubicacion">{pathname + search}</p>
}

const montar = (servicio, props = {}) =>
  render(
    <MemoryRouter initialEntries={['/cortes']}>
      <Routes>
        <Route path="/cortes" element={<TarjetaServicio servicio={servicio} {...props} />} />
        <Route path="/reservar-corte" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>
  )

describe('TarjetaServicio', () => {
  it('muestra categoría, tipo, nombre, descripción, duración y precio que vienen de la API', () => {
    montar(SERVICIOS_API[1]) // Corte degradado (Fade), élite

    expect(screen.getByText('Cortes')).toBeInTheDocument()
    expect(screen.getByText('Élite')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Corte degradado (Fade)' })).toBeInTheDocument()
    expect(screen.getByText('Descripción de Corte degradado (Fade)')).toBeInTheDocument()
    expect(screen.getByText(/40 min/)).toBeInTheDocument()
    expect(screen.getByText('$25.000')).toBeInTheDocument()
  })

  it('un servicio de precio 0 muestra "Gratis"', () => {
    montar(SERVICIO_GRATIS)

    expect(screen.getByText('Gratis')).toBeInTheDocument()
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument()
  })

  it('sin descripción no deja un párrafo vacío', () => {
    const { container } = montar({ ...SERVICIOS_API[0], descripcion: null })

    expect(screen.getByRole('heading', { name: 'Corte clásico' })).toBeInTheDocument()
    expect(container.querySelectorAll('p')).toHaveLength(1) // solo la fila de duración y precio
  })

  it('un servicio sin categoría se rotula como "Otros"', () => {
    montar({ ...SERVICIOS_API[0], categoria: null })
    expect(screen.getByText('Otros')).toBeInTheDocument()
  })

  it('el nivel del título es configurable (h4 bajo un encabezado de categoría)', () => {
    montar(SERVICIOS_API[0], { Titulo: 'h4' })
    expect(screen.getByRole('heading', { level: 4, name: 'Corte clásico' })).toBeInTheDocument()
  })

  it('"Seleccionar" lleva a la reserva con el id del servicio', async () => {
    const user = userEvent.setup()
    montar(SERVICIOS_API[3])

    await user.click(screen.getByRole('button', { name: 'Seleccionar' }))

    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/reservar-corte?servicio=4')
  })
})
