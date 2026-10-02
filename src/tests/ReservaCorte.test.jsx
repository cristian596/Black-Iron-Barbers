import { render, screen, within } from '@testing-library/react'
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

// "Continuar" vive duplicado en el DOM (panel de escritorio + barra móvil); Tailwind
// decide cuál se ve, pero jsdom no aplica esas reglas CSS, así que ambos existen en
// las pruebas. Las dos instancias comparten el mismo estado habilitado/deshabilitado
// y el mismo manejador, así que basta con operar sobre la primera.
const botonesContinuar = () => screen.getAllByRole('button', { name: /^continuar$/i })
const clickContinuar = async (user) => user.click(botonesContinuar()[0])
const continuarHabilitado = () => botonesContinuar().every((boton) => !boton.disabled)
const continuarDeshabilitado = () => botonesContinuar().every((boton) => boton.disabled)

const seleccionarPrimeraFecha = async (user) => {
  const grupoFechas = await screen.findByRole('group', { name: /fechas disponibles/i })
  await user.click(within(grupoFechas).getAllByRole('button')[0])
}

const llegarAlModal = async (user) => {
  await screen.findByRole('button', { name: /corte clasico/i })
  await clickContinuar(user) // → barbero
  await screen.findByRole('heading', { name: /cualquier barbero/i })
  await clickContinuar(user) // → fecha-hora
  await seleccionarPrimeraFecha(user)
  await user.click(await screen.findByRole('button', { name: '10:00' }))
  await clickContinuar(user) // → confirmar (abre el modal)
  await screen.findByRole('dialog')
}

const llenarContactoValido = async (user) => {
  await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
  await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
  await user.type(screen.getByLabelText('Teléfono'), '3001234567')
  await user.click(screen.getByRole('checkbox'))
}

const renderConRuta = (ruta = '/reservar-corte') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ReservaCorte />
    </MemoryRouter>
  )

describe('ReservaCorte — contenedor y navegación por pasos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obtenerServicios.mockResolvedValue(SERVICIOS)
    obtenerBarberos.mockResolvedValue(BARBEROS)
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30'] })
  })

  it('muestra el indicador de progreso con los 4 pasos y empieza en "Servicio"', async () => {
    renderConRuta()

    await screen.findByRole('button', { name: /corte clasico/i })
    const indicador = screen.getByRole('list', { name: /progreso de la reserva/i })
    expect(indicador).toHaveTextContent('Servicio')
    expect(indicador).toHaveTextContent('Barbero')
    expect(indicador).toHaveTextContent('Fecha y hora')
    expect(indicador).toHaveTextContent('Confirmar')
  })

  it('el botón "Atrás" está deshabilitado en el primer paso', async () => {
    renderConRuta()

    await screen.findByRole('button', { name: /corte clasico/i })
    expect(screen.getByRole('button', { name: /atrás/i })).toBeDisabled()
  })

  it('el botón "Continuar" está deshabilitado mientras el paso Servicio no tiene servicio_id (vía query param)', async () => {
    renderConRuta('/reservar-corte')

    await screen.findByRole('button', { name: /corte clasico/i })
    expect(continuarDeshabilitado()).toBe(true)
  })

  it('con ?servicio= en la URL, "Continuar" se habilita y avanza al paso Barbero', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    expect(continuarHabilitado()).toBe(true)

    await clickContinuar(user)
    await screen.findByRole('heading', { name: /cualquier barbero/i })
  })

  it('el paso Barbero siempre permite continuar (Cualquier barbero es una elección válida)', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    await clickContinuar(user)

    await screen.findByRole('heading', { name: /cualquier barbero/i })
    expect(continuarHabilitado()).toBe(true)
  })

  it('"Atrás" vuelve al paso anterior sin perder la selección de servicio', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    await clickContinuar(user)
    await screen.findByRole('heading', { name: /cualquier barbero/i })

    await user.click(screen.getByRole('button', { name: /atrás/i }))
    await screen.findByRole('button', { name: /corte clasico/i })
    // El servicio preseleccionado por query param sigue permitiendo continuar de nuevo.
    expect(continuarHabilitado()).toBe(true)
  })

  it('seleccionar una tarjeta de servicio habilita "Continuar"', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte')

    await screen.findByRole('button', { name: /corte clasico/i })
    expect(continuarDeshabilitado()).toBe(true)

    await user.click(screen.getByRole('button', { name: /corte clasico/i }))
    expect(continuarHabilitado()).toBe(true)
  })

  it('en el paso Barbero, "Cualquier barbero" aparece seleccionado por defecto', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    await clickContinuar(user)

    const cualquierBarbero = (await screen.findByRole('heading', { name: /cualquier barbero/i })).closest('button')
    expect(cualquierBarbero).toHaveAttribute('aria-pressed', 'true')
  })

  it('con ?barbero= en la URL, ese barbero aparece preseleccionado en el paso Barbero', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1&barbero=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    await clickContinuar(user)

    const boby = (await screen.findByRole('heading', { name: 'Boby' })).closest('button')
    expect(boby).toHaveAttribute('aria-pressed', 'true')
  })

  it('llega al paso Fecha y hora, elige fecha y hora, y vuelve atrás sin perderlas', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1&barbero=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    await clickContinuar(user) // → barbero
    await screen.findByRole('heading', { name: /cualquier barbero/i })
    await clickContinuar(user) // → fecha-hora
    await seleccionarPrimeraFecha(user)

    const horaBoton = await screen.findByRole('button', { name: '10:00' })
    expect(continuarDeshabilitado()).toBe(true)

    await user.click(horaBoton)
    expect(continuarHabilitado()).toBe(true)

    await user.click(screen.getByRole('button', { name: /atrás/i })) // → barbero
    await screen.findByRole('heading', { name: /cualquier barbero/i })
    await clickContinuar(user) // → fecha-hora de nuevo

    // La hora elegida antes se conserva porque no se tocó ni servicio ni barbero.
    expect(await screen.findByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiar de barbero invalida la fecha/hora ya elegidas', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1&barbero=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    await clickContinuar(user) // → barbero
    await screen.findByRole('heading', { name: /cualquier barbero/i })
    await clickContinuar(user) // → fecha-hora
    await seleccionarPrimeraFecha(user)

    await user.click(await screen.findByRole('button', { name: '10:00' }))
    expect(continuarHabilitado()).toBe(true)

    await user.click(screen.getByRole('button', { name: /atrás/i })) // → barbero
    await user.click((await screen.findByRole('heading', { name: /cualquier barbero/i })).closest('button'))
    await clickContinuar(user) // → fecha-hora

    // Al volver a fecha-hora después de tocar el barbero, ya no hay hora seleccionada.
    expect(continuarDeshabilitado()).toBe(true)
  })

  it('muestra un error si falla la carga de servicios/barberos', async () => {
    obtenerServicios.mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    renderConRuta()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })
})

describe('ReservaCorte — resumen (panel lateral / barra móvil)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obtenerServicios.mockResolvedValue(SERVICIOS)
    obtenerBarberos.mockResolvedValue(BARBEROS)
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30'] })
  })

  it('muestra el panel de escritorio y la barra móvil, cada uno con su propio total', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte')

    await user.click(await screen.findByRole('button', { name: /corte clasico/i }))

    const resumenes = screen.getAllByLabelText(/resumen de la reserva/i)
    expect(resumenes).toHaveLength(2) // aside de escritorio + barra fija móvil
    resumenes.forEach((resumen) => {
      expect(within(resumen).getByText('$55.000')).toBeInTheDocument()
    })
  })

  it('el total no aparece hasta elegir un servicio', async () => {
    renderConRuta('/reservar-corte')
    await screen.findByRole('button', { name: /corte clasico/i })

    const resumenes = screen.getAllByLabelText(/resumen de la reserva/i)
    resumenes.forEach((resumen) => {
      expect(within(resumen).queryByText(/^\$/)).not.toBeInTheDocument()
    })
  })
})

describe('ReservaCorte — confirmación y éxito', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obtenerServicios.mockResolvedValue(SERVICIOS)
    obtenerBarberos.mockResolvedValue(BARBEROS)
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30'] })
  })

  it('al confirmar con éxito, envía servicio_id, barbero_id, fecha, hora, telefono y consentimiento, y muestra el resumen del SERVIDOR (no la selección del cliente)', async () => {
    const user = userEvent.setup()
    crearCita.mockResolvedValueOnce({
      id: 7,
      servicio_nombre: 'Corte Clasico',
      barbero_nombre: 'Dani', // el servidor asignó un barbero distinto al "Cualquier barbero" elegido
      fecha: '2030-06-15T05:00:00.000Z',
      hora: '10:00:00',
      duracion_min: 35,
      precio: 55000,
      estado: 'pendiente',
    })

    renderConRuta('/reservar-corte?servicio=1')
    await llegarAlModal(user)
    await llenarContactoValido(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(screen.getByText('Dani')).toBeInTheDocument()

    expect(crearCita).toHaveBeenCalledWith(
      expect.objectContaining({
        servicio_id: 1,
        barbero_id: undefined,
        fecha: expect.any(String),
        hora: '10:00',
        telefono: '3001234567',
        consentimiento: true,
      })
    )
  })

  it('con 409 (hora ya tomada), vuelve al paso Fecha y hora, muestra el aviso y recarga la disponibilidad', async () => {
    const user = userEvent.setup()
    const errorConflicto = new Error('Ese horario ya está reservado para este barbero, elige otro')
    errorConflicto.status = 409
    crearCita.mockRejectedValueOnce(errorConflicto)

    renderConRuta('/reservar-corte?servicio=1')
    await llegarAlModal(user)
    await llenarContactoValido(user)

    obtenerDisponibilidad.mockResolvedValueOnce({ horas: ['10:30'] }) // la hora ya no está libre
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/esa hora ya fue tomada/i)
    // El modal se cerró y volvimos al paso de fecha/hora.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '10:30' })).toBeInTheDocument()
    // La disponibilidad se volvió a consultar (al menos la llamada inicial + la de recarga).
    expect(obtenerDisponibilidad.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('no deja los botones "Continuar" visibles detrás del modal de confirmación', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1')
    await llegarAlModal(user)

    expect(screen.queryByRole('button', { name: /^continuar$/i })).not.toBeInTheDocument()
  })
})
