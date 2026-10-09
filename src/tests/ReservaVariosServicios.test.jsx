import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReservaCorte from '../pages/ReservaCorte'
import { ProveedorCarrito } from '../context/CarritoContext'
import { obtenerServicios, obtenerBarberos, obtenerDisponibilidad, crearCita } from '../services/api'

vi.mock('../services/api', () => ({
  obtenerServicios: vi.fn(),
  // Sin asesorías por defecto: estos tests son del flujo de cortes (las de asesorías están en ReservaAsesoria.test.jsx).
  obtenerServiciosAsesoria: vi.fn().mockResolvedValue([]),
  obtenerBarberos: vi.fn(),
  obtenerDisponibilidad: vi.fn(),
  crearCita: vi.fn(),
}))

const CLAVE = 'seleccion-servicios'
const CORTES = { id: 1, nombre: 'Cortes', slug: 'cortes' }
const BARBA = { id: 2, nombre: 'Barba', slug: 'barba' }
const ROSTRO = { id: 3, nombre: 'Rostro', slug: 'rostro' }
const LARGOS = { id: 4, nombre: 'Tratamientos', slug: 'tratamientos' }

const s = (id, nombre, duracion_min, precio, categoria) => ({
  id,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  tipo: 'original',
  duracion_min,
  precio,
  categoria,
})

const CORTE = s(1, 'Corte clásico', 30, 18000, CORTES)
const PERFIL = s(2, 'Perfilado de barba', 30, 12000, BARBA)
const CEJAS = s(3, 'Cejas', 20, 5000, ROSTRO)
const LARGO_A = s(4, 'Tratamiento A', 120, 80000, LARGOS)
const LARGO_B = s(5, 'Tratamiento B', 120, 90000, LARGOS)
const LARGO_C = s(6, 'Tratamiento C', 60, 40000, LARGOS)
const CATALOGO = [CORTE, PERFIL, CEJAS, LARGO_A, LARGO_B, LARGO_C]
const BARBEROS = [{ id: 1, nombre: 'Boby', especialidad: 'Fade y Barba' }]

const botonesContinuar = () => screen.getAllByRole('button', { name: /^continuar$/i })
const clickContinuar = async (user) => user.click(botonesContinuar()[0])
const continuarDeshabilitado = () => botonesContinuar().every((b) => b.disabled)
const continuarHabilitado = () => botonesContinuar().every((b) => !b.disabled)
const tarjeta = (nombre) => screen.getByRole('heading', { name: nombre }).closest('button')
const elegidas = () => screen.getAllByRole('button', { pressed: true }).filter((b) => b.querySelector('h3, h4'))
const cargado = () => screen.findByRole('group', { name: 'Categoría' })
const verTodas = async (user) => user.click(within(screen.getByRole('group', { name: 'Categoría' })).getByRole('button', { name: 'Todos' }))
const guardado = () => JSON.parse(sessionStorage.getItem(CLAVE))

const montar = (ruta, { carrito } = {}) => {
  if (carrito) sessionStorage.setItem(CLAVE, JSON.stringify(carrito))
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorCarrito>
        <ReservaCorte />
      </ProveedorCarrito>
    </MemoryRouter>
  )
}

// Los botones de hora son BLOQUES de 1 hora ("10:00 – 11:00"): elegir uno asigna su primera hora libre.
const bloqueDe = (hora) => new RegExp('^' + hora.slice(0, 2) + ':00 – ' + (Number(hora.slice(0, 2)) + 1) + ':00')

const elegirFechaYHora = async (user, hora = '10:00') => {
  const grupo = await screen.findByRole('group', { name: /fechas disponibles/i })
  await user.click(within(grupo).getAllByRole('button')[0])
  await user.click(await screen.findByRole('button', { name: bloqueDe(hora) }))
}

const hastaFechaHora = async (user) => {
  await clickContinuar(user) // → barbero
  await screen.findByRole('heading', { name: /cualquier barbero/i })
  await clickContinuar(user) // → fecha-hora
}

const hastaElModal = async (user) => {
  await hastaFechaHora(user)
  await elegirFechaYHora(user)
  await clickContinuar(user)
  await screen.findByRole('dialog')
}

const llenarContacto = async (user) => {
  await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
  await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
  await user.type(screen.getByLabelText('Teléfono'), '3001234567')
  await user.click(screen.getByRole('checkbox'))
}

const error = (mensaje, extra) => Object.assign(new Error(mensaje), extra)

const RESPUESTA_COMBO = {
  id: 9,
  servicio_nombre: 'Corte clásico + Perfilado de barba',
  servicios: [
    { id: 1, nombre: 'Corte clásico', duracion_min: 30, precio: 18000 },
    { id: 2, nombre: 'Perfilado de barba', duracion_min: 30, precio: 12000 },
  ],
  barbero_nombre: 'Boby',
  fecha: '2030-06-15',
  hora: '10:00:00',
  duracion_min: 60,
  precio: 30000,
  estado: 'pendiente',
}

beforeEach(() => {
  vi.resetAllMocks() // también vacía las respuestas "una sola vez" que dejara un test anterior
  sessionStorage.clear()
  obtenerServicios.mockResolvedValue(CATALOGO)
  obtenerBarberos.mockResolvedValue(BARBEROS)
  obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30'] })
})

describe('Reserva con varios servicios: arranque desde la URL', () => {
  it('?servicios=1,2 arranca con ambos elegidos, resumen con la lista, duración total y total', async () => {
    montar('/reservar-corte?servicios=1,2')
    await cargado()

    expect(tarjeta('Corte clásico')).toHaveAttribute('aria-pressed', 'true')
    expect(continuarHabilitado()).toBe(true)
    // La tarjeta del resumen (escritorio) y la barra móvil comparten datos
    const [resumenEscritorio] = screen.getAllByLabelText(/resumen de la reserva/i)
    expect(within(resumenEscritorio).getByText('Servicios')).toBeInTheDocument()
    expect(within(resumenEscritorio).getByText('Perfilado de barba')).toBeInTheDocument()
    expect(within(resumenEscritorio).getByText('1 h')).toBeInTheDocument() // duración total 60 min
    expect(within(resumenEscritorio).getByText('$30.000')).toBeInTheDocument()
  })

  it('mezcla: ?servicios= con ids válidos manda sobre ?servicio=', async () => {
    montar('/reservar-corte?servicio=1&servicios=3,2')
    await cargado()
    const [resumen] = screen.getAllByLabelText(/resumen de la reserva/i)
    expect(within(resumen).getByText('Cejas')).toBeInTheDocument()
    expect(within(resumen).getByText('Perfilado de barba')).toBeInTheDocument()
    expect(within(resumen).queryByText('Corte clásico')).not.toBeInTheDocument()
  })

  it('?servicio=<id> sigue siendo el camino rápido: un solo servicio, resumen de siempre', async () => {
    montar('/reservar-corte?servicio=1')
    await cargado()
    const [resumen] = screen.getAllByLabelText(/resumen de la reserva/i)
    expect(within(resumen).getByText('Servicio')).toBeInTheDocument()
    expect(within(resumen).queryByText('Servicios')).not.toBeInTheDocument()
    expect(within(resumen).queryByText(/Duración total/)).not.toBeInTheDocument()
    expect(within(resumen).getByText('$18.000')).toBeInTheDocument()
  })

  it('ignora la basura de la URL y los repetidos; recorta a 3', async () => {
    montar('/reservar-corte?servicios=abc,2,2,-1,1,3,4')
    await cargado()
    const [resumen] = screen.getAllByLabelText(/resumen de la reserva/i)
    // 2, 1, 3 en ese orden; el 4 queda fuera por el máximo
    expect(within(resumen).getByText('Perfilado de barba')).toBeInTheDocument()
    expect(within(resumen).getByText('Corte clásico')).toBeInTheDocument()
    expect(within(resumen).getByText('Cejas')).toBeInTheDocument()
    expect(within(resumen).queryByText('Tratamiento A')).not.toBeInTheDocument()
    expect(within(resumen).getByText('$35.000')).toBeInTheDocument()
  })

  it('una URL sin nada válido deja el paso 1 sin selección y "Continuar" deshabilitado', async () => {
    montar('/reservar-corte?servicios=abc,,-3')
    await cargado()
    expect(continuarDeshabilitado()).toBe(true)
  })

  it('un id inactivo en ?servicios= quita SOLO ese y conserva el resto, con aviso', async () => {
    montar('/reservar-corte?servicios=1,99')

    expect(await screen.findByRole('alert')).toHaveTextContent(/quitamos de tu selección/i)
    await cargado()
    expect(tarjeta('Corte clásico')).toHaveAttribute('aria-pressed', 'true')
    expect(continuarHabilitado()).toBe(true)
    expect(obtenerServicios).toHaveBeenCalledTimes(2)
  })

  it('un combo de la URL que pasa de 240 min se avisa desde el principio y la selección se conserva', async () => {
    montar('/reservar-corte?servicios=4,5,3')
    expect(await screen.findByRole('alert')).toHaveTextContent(/240 min/)
    expect(tarjeta('Tratamiento A')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Reserva con varios servicios: disponibilidad e invalidación', () => {
  it('pide la disponibilidad con la lista completa de servicios', async () => {
    const user = userEvent.setup()
    montar('/reservar-corte?servicios=1,2,3')
    await cargado()
    await hastaFechaHora(user)
    await elegirFechaYHora(user)

    expect(obtenerDisponibilidad).toHaveBeenCalledWith([1, 2, 3], expect.any(String), null)
  })

  it('con un solo servicio (?servicio=) la lista tiene ese único id', async () => {
    const user = userEvent.setup()
    montar('/reservar-corte?servicio=1')
    await cargado()
    await hastaFechaHora(user)
    await elegirFechaYHora(user)
    expect(obtenerDisponibilidad).toHaveBeenCalledWith([1], expect.any(String), null)
  })

  it('cambiar la selección en el paso 1 invalida la fecha y la hora elegidas y vuelve a pedir horas', async () => {
    const user = userEvent.setup()
    montar('/reservar-corte?servicios=1,2')
    await cargado()
    await hastaFechaHora(user)
    await elegirFechaYHora(user)
    expect(continuarHabilitado()).toBe(true)

    await user.click(screen.getByRole('button', { name: /atrás/i })) // barbero
    await user.click(screen.getByRole('button', { name: /atrás/i })) // servicio
    await verTodas(user)
    await user.click(await screen.findByRole('button', { name: /cejas/i })) // se suma un tercer servicio
    await hastaFechaHora(user)

    // Sin fecha ni hora: hay que elegirlas otra vez
    expect(continuarDeshabilitado()).toBe(true)
    expect(screen.getByText('Selecciona primero una fecha.')).toBeInTheDocument()
    await elegirFechaYHora(user)
    expect(obtenerDisponibilidad).toHaveBeenLastCalledWith([1, 2, 3], expect.any(String), null)
  })

  it('si no cambia la selección, volver atrás y adelante conserva fecha y hora', async () => {
    const user = userEvent.setup()
    montar('/reservar-corte?servicios=1,2')
    await cargado()
    await hastaFechaHora(user)
    await elegirFechaYHora(user)

    await user.click(screen.getByRole('button', { name: /atrás/i }))
    await user.click(screen.getByRole('button', { name: /atrás/i }))
    await cargado()
    await hastaFechaHora(user)

    expect(await screen.findByRole('button', { name: bloqueDe('10:00') })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Reserva con varios servicios: confirmación y éxito', () => {
  it('el modal lista los servicios con su duración y precio, la duración total y el total', async () => {
    const user = userEvent.setup()
    montar('/reservar-corte?servicios=1,2')
    await cargado()
    await hastaElModal(user)

    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Servicios')).toBeInTheDocument()
    expect(within(modal).getByText('Corte clásico')).toBeInTheDocument()
    expect(within(modal).getByText('30 min · $18.000')).toBeInTheDocument()
    expect(within(modal).getByText('1 h')).toBeInTheDocument()
    expect(within(modal).getByText('$30.000')).toBeInTheDocument()
  })

  it('envía servicios_ids en orden y muestra la lista del SERVIDOR en la pantalla de éxito', async () => {
    const user = userEvent.setup()
    crearCita.mockResolvedValueOnce(RESPUESTA_COMBO)
    montar('/reservar-corte?servicios=2,1')
    await cargado()
    await hastaElModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(crearCita).toHaveBeenCalledWith(expect.objectContaining({ servicios_ids: [2, 1], barbero_id: undefined }))
    expect(crearCita.mock.calls[0][0]).not.toHaveProperty('servicio_id')
    expect(screen.getByText('Perfilado de barba')).toBeInTheDocument()
    expect(screen.getByText('1 h')).toBeInTheDocument()
    expect(screen.getByText('$30.000')).toBeInTheDocument()
  })
})

describe('Reserva con varios servicios: errores del servidor', () => {
  const llegarAConfirmar = async (user, ruta) => {
    montar(ruta)
    await cargado()
    await hastaElModal(user)
    await llenarContacto(user)
  }

  it('SERVICIO_NO_DISPONIBLE con servicios_no_disponibles: quita SOLO esos, conserva el resto y avisa', async () => {
    const user = userEvent.setup()
    crearCita.mockRejectedValueOnce(
      error('Uno o más servicios seleccionados no existen o no están disponibles', {
        status: 400,
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicios_no_disponibles: [2],
      })
    )
    await llegarAConfirmar(user, '/reservar-corte?servicios=1,2,3')

    obtenerServicios.mockResolvedValueOnce(CATALOGO.filter((x) => x.id !== 2)) // la recarga ya no trae el 2
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/quitamos de tu selección/i)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /elige tus servicios/i })).toBeInTheDocument()
    expect(tarjeta('Corte clásico')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Perfilado de barba' })).not.toBeInTheDocument()
    expect(continuarHabilitado()).toBe(true)
    const [resumen] = screen.getAllByLabelText(/resumen de la reserva/i)
    expect(within(resumen).getByText('Cejas')).toBeInTheDocument()
    expect(within(resumen).getByText('Corte clásico')).toBeInTheDocument()
  })

  it('al pedir horas, SERVICIO_NO_DISPONIBLE también quita solo los afectados', async () => {
    const user = userEvent.setup()
    obtenerDisponibilidad.mockRejectedValue(
      error('no disponible', { status: 400, codigo: 'SERVICIO_NO_DISPONIBLE', servicios_no_disponibles: [1] })
    )
    montar('/reservar-corte?servicios=1,2')
    await cargado()
    await hastaFechaHora(user)
    obtenerServicios.mockResolvedValueOnce(CATALOGO.filter((x) => x.id !== 1))
    const grupo = await screen.findByRole('group', { name: /fechas disponibles/i })
    await user.click(within(grupo).getAllByRole('button')[0])

    expect(await screen.findByRole('alert')).toHaveTextContent(/quitamos de tu selección/i)
    expect(await screen.findByRole('heading', { name: 'Perfilado de barba' })).toBeInTheDocument()
    expect(tarjeta('Perfilado de barba')).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    ['DURACION_EXCEDIDA', /240 min/],
    ['LIMITE_SERVICIOS', /máximo 3 servicios/i],
    ['SERVICIOS_REPETIDOS', /no puedes repetir/i],
  ])('%s: cierra el modal, vuelve al paso Servicio, muestra el motivo y conserva la selección', async (codigo, texto) => {
    const user = userEvent.setup()
    crearCita.mockRejectedValueOnce(error('rechazado por el servidor', { status: 400, codigo }))
    await llegarAConfirmar(user, '/reservar-corte?servicios=1,2')

    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /elige tus servicios/i })).toBeInTheDocument()
    expect(tarjeta('Corte clásico')).toHaveAttribute('aria-pressed', 'true')
    expect(continuarHabilitado()).toBe(true)
  })

  it('el choque de horario de siempre (409) vuelve al paso Fecha y hora con el combo intacto', async () => {
    const user = userEvent.setup()
    crearCita.mockRejectedValueOnce(error('Ese horario ya está reservado', { status: 409 }))
    await llegarAConfirmar(user, '/reservar-corte?servicios=1,2')

    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    // MODIFICADO: con el 409 ya no hay alerta; se reasigna la siguiente hora libre del MISMO bloque de 1 hora y se avisa.
    expect(await screen.findByText(/la hora de las 10:00 se ocupó. te asignamos las 10:30/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: bloqueDe('10:00') })).toHaveAttribute('aria-pressed', 'true')
    expect(obtenerDisponibilidad).toHaveBeenLastCalledWith([1, 2], expect.any(String), null)
  })

  it('un 400 sin código sigue mostrándose dentro del modal', async () => {
    const user = userEvent.setup()
    crearCita.mockRejectedValueOnce(error('La fecha no es válida', { status: 400 }))
    await llegarAConfirmar(user, '/reservar-corte?servicios=1,2')

    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByText('La fecha no es válida')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Reserva y carrito: el flujo tiene su propio estado', () => {
  const reservarConExito = async (user, ruta, opciones) => {
    crearCita.mockResolvedValueOnce(RESPUESTA_COMBO)
    montar(ruta, opciones)
    await cargado()
    await hastaElModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByText(/¡cita agendada con éxito!/i)
  }

  it('si la reserva vino del carrito (?servicios=), al reservar con éxito el carrito se vacía', async () => {
    const user = userEvent.setup()
    await reservarConExito(user, '/reservar-corte?servicios=1,2', { carrito: [1, 2] })
    expect(sessionStorage.getItem(CLAVE)).toBeNull()
  })

  it('si vino por el camino rápido (?servicio=), el carrito NO se toca', async () => {
    const user = userEvent.setup()
    await reservarConExito(user, '/reservar-corte?servicio=1', { carrito: [2, 3] })
    expect(guardado()).toEqual([2, 3])
  })

  it('una reserva sin parámetros (elegida en el paso 1) tampoco toca el carrito', async () => {
    const user = userEvent.setup()
    crearCita.mockResolvedValueOnce(RESPUESTA_COMBO)
    montar('/reservar-corte', { carrito: [3] })
    await cargado()
    await user.click(tarjeta('Corte clásico'))
    await hastaElModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByText(/¡cita agendada con éxito!/i)
    expect(guardado()).toEqual([3])
  })

  it('cambiar la selección dentro del paso 1 no modifica el carrito', async () => {
    const user = userEvent.setup()
    montar('/reservar-corte?servicios=1,2', { carrito: [1, 2] })
    await cargado()

    await verTodas(user)
    await user.click(tarjeta('Perfilado de barba')) // lo quita de la reserva
    await user.click(await screen.findByRole('button', { name: /cejas/i })) // y suma otro

    expect(guardado()).toEqual([1, 2])
  })

  it('una reserva que falla no vacía el carrito', async () => {
    const user = userEvent.setup()
    crearCita.mockRejectedValueOnce(error('Ese horario ya está reservado', { status: 409 }))
    montar('/reservar-corte?servicios=1,2', { carrito: [1, 2] })
    await cargado()
    await hastaElModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByText(/te asignamos las 10:30/i) // MODIFICADO: el 409 reasigna otra hora del bloque en vez de una alerta

    expect(guardado()).toEqual([1, 2])
  })

  it('un servicio por el camino rápido sigue exactamente igual: servicios_ids con un id y total del servicio', async () => {
    const user = userEvent.setup()
    crearCita.mockResolvedValueOnce({
      id: 3,
      servicio_nombre: 'Corte clásico',
      servicios: [{ id: 1, nombre: 'Corte clásico', duracion_min: 30, precio: 18000 }],
      barbero_nombre: 'Boby',
      fecha: '2030-06-15',
      hora: '10:00:00',
      duracion_min: 30,
      precio: 18000,
    })
    montar('/reservar-corte?servicio=1')
    await cargado()
    await hastaElModal(user)
    expect(within(screen.getByRole('dialog')).getByText('30 min')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).queryByText('Servicios')).not.toBeInTheDocument()
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(crearCita).toHaveBeenCalledWith(expect.objectContaining({ servicios_ids: [1] }))
    expect(screen.queryByText('Servicios')).not.toBeInTheDocument()
    expect(screen.getByText('30 min')).toBeInTheDocument()
  })

  it('"elegidas" ayudante: el combo del carrito aparece marcado en el paso 1', async () => {
    montar('/reservar-corte?servicios=1,2')
    await cargado()
    expect(elegidas().length).toBeGreaterThanOrEqual(1)
  })
})
