import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PasoFechaHora from '../components/sections/reserva/PasoFechaHora'
import { obtenerDisponibilidad } from '../services/api'
import { hoyISO, sumarDiasISO, formatearFechaChip } from '../utils/fechas'

vi.mock('../services/api', () => ({
  obtenerDisponibilidad: vi.fn(),
}))

// El día del mes puede repetirse dentro del rango de chips (p. ej. hoy y +30 días
// caen en el mismo número); se busca el chip exacto dentro del grupo "Fechas
// disponibles" comparando día y mes para no depender del orden/posición.
const encontrarChip = (fechaISO) => {
  const { dia, mes } = formatearFechaChip(fechaISO)
  const grupo = screen.getByRole('group', { name: /fechas disponibles/i })
  return within(grupo)
    .getAllByRole('button')
    .find((boton) => boton.textContent.includes(String(dia)) && boton.textContent.toLowerCase().includes(mes.toLowerCase()))
}

describe('PasoFechaHora', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra chips de fecha empezando hoy, sin fechas pasadas', () => {
    render(
      <PasoFechaHora
        servicioId={1}
        barberoId={null}
        fecha=""
        hora=""
        onSeleccionarFecha={vi.fn()}
        onSeleccionarHora={vi.fn()}
      />
    )

    expect(encontrarChip(hoyISO())).toBeInTheDocument()
    expect(screen.getByText('Selecciona primero una fecha.')).toBeInTheDocument()
  })

  it('al elegir una fecha, pide la disponibilidad con servicio_id, fecha y barbero', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30'] })
    const user = userEvent.setup()
    const onSeleccionarFecha = vi.fn()
    const fecha = sumarDiasISO(hoyISO(), 2)

    render(
      <PasoFechaHora
        servicioId={3}
        barberoId={5}
        fecha=""
        hora=""
        onSeleccionarFecha={onSeleccionarFecha}
        onSeleccionarHora={vi.fn()}
      />
    )

    await user.click(encontrarChip(fecha))

    expect(onSeleccionarFecha).toHaveBeenCalledWith(fecha)
  })

  it('sin barbero (Cualquier barbero), no envía el parámetro barbero', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: [] })
    const fecha = sumarDiasISO(hoyISO(), 1)

    render(
      <PasoFechaHora
        servicioId={1}
        barberoId={null}
        fecha={fecha}
        hora=""
        onSeleccionarFecha={vi.fn()}
        onSeleccionarHora={vi.fn()}
      />
    )

    await waitFor(() => expect(obtenerDisponibilidad).toHaveBeenCalledWith(1, fecha, null))
  })

  it('muestra las horas devueltas por la API y permite seleccionarlas', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['09:00', '09:30'] })
    const user = userEvent.setup()
    const onSeleccionarHora = vi.fn()
    const fecha = sumarDiasISO(hoyISO(), 1)

    render(
      <PasoFechaHora
        servicioId={1}
        barberoId={2}
        fecha={fecha}
        hora=""
        onSeleccionarFecha={vi.fn()}
        onSeleccionarHora={onSeleccionarHora}
      />
    )

    const botonHora = await screen.findByRole('button', { name: '09:00' })
    await user.click(botonHora)

    expect(onSeleccionarHora).toHaveBeenCalledWith('09:00')
  })

  it('muestra un mensaje cuando no hay horas disponibles ese día', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: [] })
    const fecha = sumarDiasISO(hoyISO(), 1)

    render(
      <PasoFechaHora
        servicioId={1}
        barberoId={null}
        fecha={fecha}
        hora=""
        onSeleccionarFecha={vi.fn()}
        onSeleccionarHora={vi.fn()}
      />
    )

    expect(await screen.findByText('No hay horas disponibles para esa fecha.')).toBeInTheDocument()
  })

  it('muestra el error del servidor si falla la consulta de disponibilidad', async () => {
    obtenerDisponibilidad.mockRejectedValue(new Error('No se pudo conectar con el servidor'))
    const fecha = sumarDiasISO(hoyISO(), 1)

    render(
      <PasoFechaHora
        servicioId={1}
        barberoId={null}
        fecha={fecha}
        hora=""
        onSeleccionarFecha={vi.fn()}
        onSeleccionarHora={vi.fn()}
      />
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })
})
