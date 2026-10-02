import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReservaCorte from '../pages/ReservaCorte'
import { obtenerServicios, obtenerBarberos, obtenerDisponibilidad, crearCita } from '../services/api'

vi.mock('../services/api', () => ({
  obtenerServicios: vi.fn(),
  obtenerBarberos: vi.fn(),
  obtenerDisponibilidad: vi.fn(),
  crearCita: vi.fn(),
}))

const SERVICIOS = [{ id: 1, nombre: 'Corte Clasico', duracion_min: 35, precio: 55000 }]
const BARBEROS = [{ id: 1, nombre: 'Boby', especialidad: 'Fade y Barba' }]
const HORAS = ['10:00', '10:30']

const completarFormulario = async (user) => {
  await user.type(screen.getByLabelText('Cliente'), 'Juan Perez')
  await user.type(screen.getByLabelText('Correo Electronico'), 'juan@example.com')
  await user.click(screen.getByRole('button', { name: /corte clasico/i }))
  await user.click(screen.getByRole('button', { name: /boby/i }))
  fireEvent.change(screen.getByLabelText(/seleccione la fecha/i), { target: { value: '2030-01-15' } })
  await user.click(await screen.findByRole('button', { name: '10:00' }))
}

describe('ReservaCorte', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obtenerServicios.mockResolvedValue(SERVICIOS)
    obtenerBarberos.mockResolvedValue(BARBEROS)
    obtenerDisponibilidad.mockResolvedValue({ horas: HORAS })
  })

  it('envia la reserva con los datos correctos y muestra la confirmacion', async () => {
    crearCita.mockResolvedValueOnce({ id: 1, estado: 'pendiente' })
    const user = userEvent.setup()
    render(<ReservaCorte />, { wrapper: MemoryRouter })

    await screen.findByRole('button', { name: /corte clasico/i })
    await completarFormulario(user)
    await user.click(screen.getByRole('button', { name: /agendar cita/i }))

    expect(await screen.findByText('¡Cita agendada con éxito! Te esperamos.')).toBeInTheDocument()
    expect(crearCita).toHaveBeenCalledWith({
      cliente: 'Juan Perez',
      correo: 'juan@example.com',
      servicio_id: 1,
      barbero_id: 1,
      fecha: '2030-01-15',
      hora: '10:00',
    })
  })

  it('muestra el mensaje de horario ocupado cuando la API responde 409', async () => {
    const errorConflicto = new Error('Ese horario ya está reservado para este barbero, elige otro')
    errorConflicto.status = 409
    crearCita.mockRejectedValueOnce(errorConflicto)
    const user = userEvent.setup()
    render(<ReservaCorte />, { wrapper: MemoryRouter })

    await screen.findByRole('button', { name: /corte clasico/i })
    await completarFormulario(user)
    await user.click(screen.getByRole('button', { name: /agendar cita/i }))

    expect(await screen.findByText('Ese horario ya fue tomado, elige otra hora')).toBeInTheDocument()
  })
})
