import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PasoBarbero from '../components/sections/reserva/PasoBarbero'

const BARBEROS = [
  { id: 1, nombre: 'Boby', especialidad: 'Fade y Barba', foto: '/Barberos/boby.jpg' },
  { id: 2, nombre: 'Dani', especialidad: 'Estilo Clasico', foto: '/Barberos/dani.jpg' },
]

const tarjetaDe = (nombre) => screen.getByRole('heading', { name: nombre }).closest('button')

describe('PasoBarbero', () => {
  it('muestra "Cualquier barbero" seleccionado por defecto cuando barberoIdSeleccionado es null', () => {
    render(<PasoBarbero barberos={BARBEROS} barberoIdSeleccionado={null} onSeleccionar={vi.fn()} />)

    expect(tarjetaDe('Cualquier barbero')).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetaDe('Boby')).toHaveAttribute('aria-pressed', 'false')
  })

  it('muestra una tarjeta por cada barbero con su foto y especialidad', () => {
    render(<PasoBarbero barberos={BARBEROS} barberoIdSeleccionado={null} onSeleccionar={vi.fn()} />)

    expect(tarjetaDe('Boby')).toBeInTheDocument()
    expect(tarjetaDe('Dani')).toBeInTheDocument()
    expect(screen.getByAltText(/foto de boby/i)).toHaveAttribute('src', '/Barberos/boby.jpg')
    expect(screen.getByText('Fade y Barba')).toBeInTheDocument()
  })

  it('marca como seleccionado el barbero cuyo id coincide', () => {
    render(<PasoBarbero barberos={BARBEROS} barberoIdSeleccionado={2} onSeleccionar={vi.fn()} />)

    expect(tarjetaDe('Dani')).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetaDe('Cualquier barbero')).toHaveAttribute('aria-pressed', 'false')
  })

  it('llama a onSeleccionar(null) al elegir "Cualquier barbero"', async () => {
    const user = userEvent.setup()
    const onSeleccionar = vi.fn()
    render(<PasoBarbero barberos={BARBEROS} barberoIdSeleccionado={1} onSeleccionar={onSeleccionar} />)

    await user.click(tarjetaDe('Cualquier barbero'))

    expect(onSeleccionar).toHaveBeenCalledWith(null)
  })

  it('llama a onSeleccionar con el id al elegir un barbero específico', async () => {
    const user = userEvent.setup()
    const onSeleccionar = vi.fn()
    render(<PasoBarbero barberos={BARBEROS} barberoIdSeleccionado={null} onSeleccionar={onSeleccionar} />)

    await user.click(tarjetaDe('Dani'))

    expect(onSeleccionar).toHaveBeenCalledWith(2)
  })
})
