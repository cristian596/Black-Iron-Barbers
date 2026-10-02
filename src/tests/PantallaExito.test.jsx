import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PantallaExito from '../components/sections/reserva/PantallaExito'

const RESUMEN_SERVIDOR = {
  id: 42,
  servicio_nombre: 'Combo (Pelo + Barba)',
  barbero_nombre: 'Danny', // el servidor asignó este barbero (no el que el cliente eligió)
  fecha: '2030-06-15T05:00:00.000Z',
  hora: '10:00:00',
  duracion_min: 90,
  precio: 103000,
}

describe('PantallaExito', () => {
  it('muestra el resumen que devuelve el servidor, incluido el barbero asignado', () => {
    render(<PantallaExito resumen={RESUMEN_SERVIDOR} onNuevaReserva={vi.fn()} />)

    expect(screen.getByText('Combo (Pelo + Barba)')).toBeInTheDocument()
    expect(screen.getByText('Danny')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByText('90 min')).toBeInTheDocument()
    expect(screen.getByText('$103.000')).toBeInTheDocument()
  })

  it('"Agendar otra cita" llama a onNuevaReserva', async () => {
    const onNuevaReserva = vi.fn()
    const user = userEvent.setup()
    render(<PantallaExito resumen={RESUMEN_SERVIDOR} onNuevaReserva={onNuevaReserva} />)

    await user.click(screen.getByRole('button', { name: /agendar otra cita/i }))

    expect(onNuevaReserva).toHaveBeenCalled()
  })
})
