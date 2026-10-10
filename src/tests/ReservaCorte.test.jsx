import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ReservaCorte from '../pages/ReservaCorte'
import { ProveedorCarrito } from '../context/CarritoContext'
import { obtenerServicios, obtenerBarberos, obtenerDisponibilidad, crearCita } from '../services/api'
import { TOKEN_PRUEBA, prepararVerificacionMock, verificarCorreoEnModal } from './verificacionPrueba'

vi.mock('../services/api', () => ({
  obtenerServicios: vi.fn(),
  // Sin asesorías por defecto: estos tests son del flujo de cortes (las de asesorías están en ReservaAsesoria.test.jsx).
  obtenerServiciosAsesoria: vi.fn().mockResolvedValue([]),
  obtenerBarberos: vi.fn(),
  obtenerDisponibilidad: vi.fn(),
  crearCita: vi.fn(),
  solicitarCodigoCorreo: vi.fn(),
  confirmarCodigoCorreo: vi.fn(),
}))

const CORTES = { id: 1, nombre: 'Cortes', slug: 'cortes' }
const BARBA = { id: 2, nombre: 'Barba', slug: 'barba' }
const SERVICIOS = [
  {
    id: 1,
    nombre: 'Corte Clasico',
    descripcion: 'Corte tradicional con acabado limpio',
    tipo: 'original',
    duracion_min: 35,
    precio: 55000,
    categoria: CORTES,
  },
]
const SERVICIO_BARBA = {
  id: 2,
  nombre: 'Perfilado de barba',
  descripcion: 'Perfilado de barba definido',
  tipo: 'elite',
  duracion_min: 20,
  precio: 12000,
  categoria: BARBA,
}
const SERVICIO_GRATIS = {
  id: 3,
  nombre: 'Asesoría gratuita',
  descripcion: 'Conversación sin costo',
  tipo: 'original',
  duracion_min: 15,
  precio: 0,
  categoria: CORTES,
}
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
  await user.click(await screen.findByRole('button', { name: /^10:00 – 11:00/ }))
  await clickContinuar(user) // → confirmar (abre el modal)
  await screen.findByRole('dialog')
}

const llenarContactoValido = async (user) => {
  await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
  await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
  await verificarCorreoEnModal(user) // MODIFICADO: ahora hay que verificar el correo (código de 6 dígitos) antes de poder confirmar
  await user.type(screen.getByLabelText('Teléfono'), '3001234567')
  await user.click(screen.getByRole('checkbox'))
}

// MODIFICADO: reloj fijo a las 09:00 de Bogotá. Estas pruebas eligen HOY y esperan el bloque 10–11; como ahora los bloques
// pasados de hoy se ocultan, dependían de la hora real. Solo se falsea Date (los temporizadores quedan reales).
const fijarReloj = () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-09T09:00:00-05:00'))
}
beforeEach(() => {
  sessionStorage.clear()
  fijarReloj()
  prepararVerificacionMock()
})
afterEach(() => vi.useRealTimers())

const renderConRuta = (ruta = '/reservar-corte') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorCarrito>
        <ReservaCorte />
      </ProveedorCarrito>
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

  it('el botón "Continuar" está deshabilitado mientras el paso Servicio no tiene servicios elegidos (vía query param)', async () => {
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

    const horaBoton = await screen.findByRole('button', { name: /^10:00 – 11:00/ })
    expect(continuarDeshabilitado()).toBe(true)

    await user.click(horaBoton)
    expect(continuarHabilitado()).toBe(true)

    await user.click(screen.getByRole('button', { name: /atrás/i })) // → barbero
    await screen.findByRole('heading', { name: /cualquier barbero/i })
    await clickContinuar(user) // → fecha-hora de nuevo

    // La hora elegida antes se conserva porque no se tocó ni servicio ni barbero.
    expect(await screen.findByRole('button', { name: /^10:00 – 11:00/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiar de barbero invalida la fecha/hora ya elegidas', async () => {
    const user = userEvent.setup()
    renderConRuta('/reservar-corte?servicio=1&barbero=1')

    await screen.findByRole('button', { name: /corte clasico/i })
    await clickContinuar(user) // → barbero
    await screen.findByRole('heading', { name: /cualquier barbero/i })
    await clickContinuar(user) // → fecha-hora
    await seleccionarPrimeraFecha(user)

    await user.click(await screen.findByRole('button', { name: /^10:00 – 11:00/ }))
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

  it('al confirmar con éxito, envía servicios_ids, barbero_id, fecha, hora, telefono y consentimiento, y muestra el resumen del SERVIDOR (no la selección del cliente)', async () => {
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
        servicios_ids: [1],
        barbero_id: undefined,
        verificacion_token: TOKEN_PRUEBA,
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

    // MODIFICADO: con el 409 se reasigna la siguiente hora libre del MISMO bloque (10:30) y se avisa (status).
    expect(await screen.findByText(/la hora de las 10:00 se ocupó. te asignamos las 10:30/i)).toBeInTheDocument()
    // El modal se cerró y volvimos al paso de fecha/hora, con el bloque elegido y la hora exacta nueva.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^10:00 – 11:00/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Bloque 10–11 · tu cita es a las 10:30').length).toBeGreaterThan(0)
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

const MENSAJE_NO_DISPONIBLE = 'Ese servicio ya no está disponible. Elige otro de la lista.'

const errorServicioNoDisponible = () =>
  Object.assign(new Error('El servicio seleccionado no existe o no está disponible'), {
    status: 400,
    codigo: 'SERVICIO_NO_DISPONIBLE',
  })

describe('ReservaCorte — estados de carga y servicio que deja de estar disponible', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obtenerServicios.mockResolvedValue(SERVICIOS)
    obtenerBarberos.mockResolvedValue(BARBEROS)
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30'] })
  })

  it('mientras carga muestra un estado accesible (role="status")', async () => {
    renderConRuta()

    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i)
    await screen.findByRole('button', { name: /corte clasico/i })
  })

  it('si falla la carga muestra el error con "Reintentar", que vuelve a pedir los datos', async () => {
    const user = userEvent.setup()
    obtenerServicios.mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    renderConRuta()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    expect(screen.queryByText(/no hay servicios disponibles/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('button', { name: /corte clasico/i })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(obtenerServicios).toHaveBeenCalledTimes(2)
  })

  it('con ?servicio= de un servicio activo, abre la categoría de ese servicio', async () => {
    obtenerServicios.mockResolvedValue([...SERVICIOS, SERVICIO_BARBA])
    renderConRuta('/reservar-corte?servicio=2')

    await screen.findByRole('button', { name: /perfilado de barba/i })
    const grupo = screen.getByRole('group', { name: 'Categoría' })
    expect(within(grupo).getByRole('button', { name: 'Barba' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /corte clasico/i })).not.toBeInTheDocument()
    expect(continuarHabilitado()).toBe(true)
  })

  it('un servicio de precio 0 se muestra como "Gratis" también en el total del resumen', async () => {
    const user = userEvent.setup()
    obtenerServicios.mockResolvedValue([SERVICIO_GRATIS])
    renderConRuta()

    await user.click(await screen.findByRole('button', { name: /asesoría gratuita/i }))

    screen.getAllByLabelText(/resumen de la reserva/i).forEach((resumen) => {
      expect(within(resumen).getByText('Gratis')).toBeInTheDocument()
    })
  })

  describe('las tres vías del servicio no disponible', () => {
    it('enlace viejo ?servicio=<id> inexistente: aviso, sin selección, paso Servicio y lista recargada', async () => {
      renderConRuta('/reservar-corte?servicio=99')

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_NO_DISPONIBLE)
      expect(await screen.findByRole('button', { name: /corte clasico/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /elige tus servicios/i })).toBeInTheDocument()
      expect(continuarDeshabilitado()).toBe(true)
      expect(screen.getByRole('button', { name: /corte clasico/i })).toHaveAttribute('aria-pressed', 'false')
      expect(obtenerServicios).toHaveBeenCalledTimes(2)
    })

    it('al confirmar, un 400 con codigo cierra el modal, vuelve al paso Servicio y recarga la lista', async () => {
      const user = userEvent.setup()
      crearCita.mockRejectedValueOnce(errorServicioNoDisponible())
      renderConRuta('/reservar-corte?servicio=1')
      await llegarAlModal(user)
      await llenarContactoValido(user)

      obtenerServicios.mockResolvedValueOnce([SERVICIO_BARBA]) // la recarga ya no trae el servicio 1
      await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_NO_DISPONIBLE)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await screen.findByRole('button', { name: /perfilado de barba/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /corte clasico/i })).not.toBeInTheDocument()
      expect(continuarDeshabilitado()).toBe(true)
      expect(obtenerServicios).toHaveBeenCalledTimes(2)
    })

    it('al pedir la disponibilidad, un 400 con codigo vuelve al paso Servicio con el aviso y recarga la lista', async () => {
      const user = userEvent.setup()
      obtenerDisponibilidad.mockRejectedValue(errorServicioNoDisponible())
      renderConRuta('/reservar-corte?servicio=1')

      await screen.findByRole('button', { name: /corte clasico/i })
      await clickContinuar(user) // → barbero
      await screen.findByRole('heading', { name: /cualquier barbero/i })
      await clickContinuar(user) // → fecha-hora
      await seleccionarPrimeraFecha(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_NO_DISPONIBLE)
      expect(await screen.findByRole('heading', { name: /elige tus servicios/i })).toBeInTheDocument()
      expect(continuarDeshabilitado()).toBe(true)
      expect(obtenerServicios).toHaveBeenCalledTimes(2)
    })

    it('un 400 SIN codigo al confirmar no se confunde con servicio no disponible: el error queda en el modal', async () => {
      const user = userEvent.setup()
      crearCita.mockRejectedValueOnce(Object.assign(new Error('La fecha no es válida'), { status: 400 }))
      renderConRuta('/reservar-corte?servicio=1')
      await llegarAlModal(user)
      await llenarContactoValido(user)

      await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

      expect(await screen.findByText('La fecha no es válida')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(obtenerServicios).toHaveBeenCalledTimes(1)
    })
  })
})
