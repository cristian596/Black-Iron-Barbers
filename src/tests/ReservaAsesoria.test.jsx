import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReservaCorte from '../pages/ReservaCorte'
import { ProveedorCarrito } from '../context/CarritoContext'
import * as api from '../services/api'
import { ASESORIAS_API, ASESORA, ASESOR_2, GRATIS_API, PREMIUM_API, BARBA_API } from './fixturesAsesorias'

vi.mock('../services/api')

// Reserva de asesorías en el flujo de /reservar-corte: bloque "Añadir una asesoría", llegada por ?servicios= mezclado,
// paso de profesionales (barbero / asesor / ambos), disponibilidad con asesor=, resumen, confirmación y éxito con una o
// dos citas, y el aviso de la asesoría gratuita ya usada.

const CORTES = { id: 1, nombre: 'Cortes', slug: 'cortes' }
const servicio = (id, nombre, duracion_min, precio) => ({
  id,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  tipo: 'original',
  duracion_min,
  precio,
  categoria: CORTES,
})
const CORTE = servicio(1, 'Corte clásico', 30, 20000)
const CORTE_2 = servicio(2, 'Perfilado de barba', 30, 15000)
const LARGO_1 = servicio(3, 'Tratamiento largo uno', 150, 90000)
const LARGO_2 = servicio(4, 'Tratamiento largo dos', 120, 80000)
const SERVICIOS = [CORTE, CORTE_2, LARGO_1, LARGO_2]
const BARBERO_1 = { id: 1, nombre: 'Boby', especialidad: 'Fade y Barba', area: 'barberia' }
const BARBERO_2 = { id: 2, nombre: 'Dani', especialidad: 'Clásico', area: 'barberia' }
const PERSONAL = [BARBERO_1, BARBERO_2, ASESORA, ASESOR_2]

const botonesContinuar = () => screen.getAllByRole('button', { name: /^continuar$/i })
const clickContinuar = (user) => user.click(botonesContinuar()[0])
const tarjeta = (nombre) => screen.getByRole('button', { name: new RegExp(nombre) })

const montar = (ruta = '/reservar-corte') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorCarrito>
        <ReservaCorte />
      </ProveedorCarrito>
    </MemoryRouter>
  )

const esperarCarga = () => screen.findByRole('heading', { name: /Añadir una asesoría/ })

// Los botones de hora son BLOQUES de 1 hora ("10:00 – 11:00"): elegir uno asigna su primera hora libre.
const bloqueDe = (hora) => new RegExp('^' + hora.slice(0, 2) + ':00 – ' + (Number(hora.slice(0, 2)) + 1) + ':00')

const elegirFechaYHora = async (user, hora = '10:00') => {
  const fechas = await screen.findByRole('group', { name: /fechas disponibles/i })
  await user.click(within(fechas).getAllByRole('button')[0])
  await user.click(await screen.findByRole('button', { name: bloqueDe(hora) }))
}

// Llega al modal de confirmación con lo ya elegido en la URL, sin tocar profesionales (cualquiera).
const llegarAlModal = async (user, hora = '10:00') => {
  await esperarCarga()
  await clickContinuar(user) // → profesionales
  await clickContinuar(user) // → fecha y hora
  await elegirFechaYHora(user, hora)
  await clickContinuar(user) // → confirmar
  await screen.findByRole('dialog')
}

const llenarContacto = async (user, correo = 'juan@example.com', telefono = '3001234567') => {
  await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
  await user.type(screen.getByLabelText('Correo electrónico'), correo)
  await user.type(screen.getByLabelText('Teléfono'), telefono)
  await user.click(screen.getByRole('checkbox'))
}

const CITA_ASESORIA = {
  id: 11,
  servicio_id: PREMIUM_API.id,
  servicio_nombre: 'Asesoría Premium',
  servicios: [{ id: PREMIUM_API.id, nombre: 'Asesoría Premium', duracion_min: 60, precio: 60000 }],
  barbero_id: ASESORA.id,
  barbero_nombre: 'Camila',
  fecha: '2030-06-15T05:00:00.000Z',
  hora: '10:00:00',
  duracion_min: 60,
  precio: 60000,
  estado: 'pendiente',
}
const CITA_CORTE = {
  id: 12,
  servicio_id: CORTE.id,
  servicio_nombre: 'Corte clásico',
  servicios: [{ id: CORTE.id, nombre: 'Corte clásico', duracion_min: 30, precio: 20000 }],
  barbero_id: BARBERO_1.id,
  barbero_nombre: 'Boby',
  fecha: '2030-06-15T05:00:00.000Z',
  hora: '11:00:00',
  duracion_min: 30,
  precio: 20000,
  estado: 'pendiente',
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.mocked(api.obtenerServicios).mockResolvedValue(SERVICIOS)
  vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue(ASESORIAS_API)
  vi.mocked(api.obtenerBarberos).mockResolvedValue(PERSONAL)
  vi.mocked(api.obtenerDisponibilidad).mockResolvedValue({ horas: ['10:00', '10:30'] })
  vi.mocked(api.comprobarAsesoriaGratis).mockResolvedValue({ disponible: true })
})

describe('Paso Servicio: bloque "Añadir una asesoría"', () => {
  it('lista las asesorías de la API (nombre, precio, duración) y se pueden elegir y quitar', async () => {
    const user = userEvent.setup()
    montar()
    await esperarCarga()

    const bloque = within(screen.getByRole('region', { name: /Añadir una asesoría/ }))
    expect(bloque.getAllByRole('button')).toHaveLength(3)
    expect(bloque.getByText('Gratis')).toBeInTheDocument()
    expect(bloque.getByText('$60.000')).toBeInTheDocument()
    expect(bloque.getByText('45 min')).toBeInTheDocument()

    await user.click(tarjeta('Asesoría Premium'))
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'true')
    await user.click(tarjeta('Asesoría Premium'))
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'false')
  })

  it('solo una asesoría: las demás quedan con aria-disabled y el motivo visible enlazado con aria-describedby', async () => {
    const user = userEvent.setup()
    montar()
    await esperarCarga()
    await user.click(tarjeta('Asesoría Premium'))

    const otra = tarjeta('Asesoría de barba')
    expect(otra).toHaveAttribute('aria-disabled', 'true')
    const motivo = document.getElementById(otra.getAttribute('aria-describedby'))
    expect(motivo).toHaveTextContent('Solo puedes añadir una asesoría por reserva')
    await user.click(otra)
    expect(otra).toHaveAttribute('aria-pressed', 'false')
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'true')

    // Quitar la actual libera las demás.
    await user.click(tarjeta('Asesoría Premium'))
    expect(tarjeta('Asesoría de barba')).not.toHaveAttribute('aria-disabled')
  })

  it('tope de 3 servicios en total: con asesoría + 2 de barbería nada más se puede añadir, con el motivo en texto', async () => {
    const user = userEvent.setup()
    montar()
    await esperarCarga()
    await user.click(tarjeta('Asesoría Premium'))
    await user.click(tarjeta('Corte clásico'))
    await user.click(tarjeta('Perfilado de barba'))

    const bloqueado = tarjeta('Tratamiento largo uno')
    expect(bloqueado).toHaveAttribute('aria-disabled', 'true')
    expect(document.getElementById(bloqueado.getAttribute('aria-describedby'))).toHaveTextContent('Máximo 3 servicios')
  })

  it('con 2 servicios de barbería, la asesoría también queda bloqueada por el tope de 3... y con 2 + asesoría ya no hay más', async () => {
    const user = userEvent.setup()
    montar()
    await esperarCarga()
    await user.click(tarjeta('Corte clásico'))
    await user.click(tarjeta('Perfilado de barba'))
    // 2 de barbería + 1 asesoría = 3: todavía cabe la asesoría
    expect(tarjeta('Asesoría Premium')).not.toHaveAttribute('aria-disabled')
    await user.click(tarjeta('Tratamiento largo uno'))
    // ya son 3: la asesoría se bloquea con el motivo
    const bloqueada = tarjeta('Asesoría Premium')
    expect(bloqueada).toHaveAttribute('aria-disabled', 'true')
    expect(document.getElementById(bloqueada.getAttribute('aria-describedby'))).toHaveTextContent('Máximo 3 servicios')
  })

  it('el tope de 240 min es POR CITA: una asesoría no suma a la duración de los servicios de barbería', async () => {
    const user = userEvent.setup()
    vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue([{ ...PREMIUM_API, duracion_min: 200 }])
    montar()
    await esperarCarga()
    await user.click(tarjeta('Asesoría Premium')) // 200 min
    await user.click(tarjeta('Tratamiento largo uno')) // 150 min: 350 en total, pero la barbería sola dura 150

    expect(tarjeta('Tratamiento largo uno')).toHaveAttribute('aria-pressed', 'true')
    // Dos de barbería sí suman en SU cita: 150 + 120 > 240 → bloqueado, con el motivo de siempre.
    const bloqueado = tarjeta('Tratamiento largo dos')
    expect(bloqueado).toHaveAttribute('aria-disabled', 'true')
    expect(document.getElementById(bloqueado.getAttribute('aria-describedby'))).toHaveTextContent('240 min')
  })

  it('un servicio de barbería largo (> 240 min) elegido junto a una asesoría no se bloquea por la duración', async () => {
    const user = userEvent.setup()
    vi.mocked(api.obtenerServicios).mockResolvedValue([servicio(9, 'Keratina larga', 300, 150000)])
    montar()
    await esperarCarga()
    await user.click(tarjeta('Asesoría Premium'))
    expect(tarjeta('Keratina larga')).not.toHaveAttribute('aria-disabled')
  })

  it('sin asesorías en la API no aparece el bloque y el flujo de cortes es el de siempre', async () => {
    vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue([])
    montar()
    await screen.findByRole('button', { name: /Corte clásico/ })
    expect(screen.queryByRole('heading', { name: /Añadir una asesoría/ })).toBeNull()
  })
})

describe('Llegada por ?servicios= (mezcla de asesoría y barbería)', () => {
  it('una asesoría sola preseleccionada (desde /asesorias)', async () => {
    montar(`/reservar-corte?servicios=${PREMIUM_API.id}`)
    await esperarCarga()
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'true')
    expect(botonesContinuar().every((b) => !b.disabled)).toBe(true)
  })

  it('mezcla asesoría + barbería: ambas elegidas, con la lista y la duración total en el resumen', async () => {
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`)
    await esperarCarga()
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'true')
    expect(tarjeta('Corte clásico')).toHaveAttribute('aria-pressed', 'true')
    const resumen = within(screen.getByRole('complementary', { name: /resumen de la reserva/i }))
    expect(resumen.getByText('Duración total')).toBeInTheDocument()
    expect(resumen.getByText('1 h 30 min')).toBeInTheDocument()
    expect(resumen.getByText('$80.000')).toBeInTheDocument()
  })

  it('un id que no existe en ninguna lista se descarta con aviso y se conserva el resto', async () => {
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},999`)
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya no está disponible|Quitamos/)
    await esperarCarga()
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'true')
  })

  it('dos asesorías en la URL avisan desde el principio (solo se permite una)', async () => {
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${BARBA_API.id}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo puedes reservar una asesoría a la vez')
  })

  it('una reserva que llegó por ?servicios= vacía el carrito al terminar; por ?servicio= no lo toca', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('seleccion-servicios', JSON.stringify([CORTE_2.id]))
    api.crearCita.mockResolvedValueOnce({ ...CITA_ASESORIA })
    montar(`/reservar-corte?servicios=${PREMIUM_API.id}`)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByText(/¡cita agendada con éxito!/i)
    expect(sessionStorage.getItem('seleccion-servicios')).toBeNull()
  })
})

// Fase 6, paso previo: "Reservar esta asesoría" usa el camino rápido ?servicio=<id>, que NO vacía el carrito.
describe('Llegada por ?servicio= con una asesoría (camino rápido, no toca el carrito)', () => {
  it('?servicio=<id de una asesoría> la deja preseleccionada, validada contra la API como cualquier otro servicio', async () => {
    montar(`/reservar-corte?servicio=${PREMIUM_API.id}`)
    await esperarCarga()
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'true')
    expect(botonesContinuar().every((b) => !b.disabled)).toBe(true)
  })

  it('un id que la API no trae se descarta con aviso', async () => {
    montar('/reservar-corte?servicio=999')
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese servicio ya no está disponible')
    await esperarCarga()
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'false')
  })

  it('al terminar la reserva el carrito queda intacto (con ?servicios= se vaciaba)', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('seleccion-servicios', JSON.stringify([CORTE_2.id]))
    api.crearCita.mockResolvedValueOnce({ ...CITA_ASESORIA })
    montar(`/reservar-corte?servicio=${PREMIUM_API.id}`)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByText(/¡cita agendada con éxito!/i)
    expect(JSON.parse(sessionStorage.getItem('seleccion-servicios'))).toEqual([CORTE_2.id])
  })
})

describe('Consentimiento del modal de contacto: zona clicable de 44 px', () => {
  it('toda la fila es la etiqueta (min-h-11), el checkbox conserva su tamaño y un clic en el texto lo marca', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicio=${PREMIUM_API.id}`)
    await llegarAlModal(user)
    const casilla = screen.getByRole('checkbox')
    const fila = casilla.closest('label')
    expect(fila).not.toBeNull()
    expect(fila).toHaveClass('min-h-11')
    expect(fila).toHaveAttribute('for', casilla.id)
    expect(casilla).toHaveClass('h-4', 'w-4') // el aspecto del checkbox no cambia
    expect(casilla).not.toBeChecked()
    await user.click(within(fila).getByText(/Acepto que Black Iron Barbers/))
    expect(casilla).toBeChecked()
  })
})

describe('Paso de profesionales', () => {
  it('solo barbería: los barberos de siempre, sin asesores, y el paso se llama "Barbero"', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${CORTE.id}`)
    await screen.findByRole('button', { name: /Corte clásico/ })
    await clickContinuar(user)

    expect(await screen.findByRole('heading', { name: 'Cualquier barbero' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Boby' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Camila' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Cualquier asesor/ })).toBeNull()
    expect(within(screen.getByRole('list', { name: /progreso de la reserva/i })).getByText('Barbero')).toBeInTheDocument()
  })

  it('solo asesoría: "Cualquier asesor" y los asesores, nunca barberos; el paso se llama "Asesor/a"', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${PREMIUM_API.id}`)
    await esperarCarga()
    await clickContinuar(user)

    expect(await screen.findByRole('heading', { name: 'Cualquier asesor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Camila' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mateo' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Boby' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Cualquier barbero' })).toBeNull()
    expect(within(screen.getByRole('list', { name: /progreso de la reserva/i })).getByText('Asesor/a')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cualquier asesor/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ambos: dos bloques claros, "Tu asesor/a" y "Tu barbero", con sus propias listas y elecciones por separado', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`)
    await esperarCarga()
    await clickContinuar(user)

    const asesor = within(await screen.findByRole('region', { name: 'Tu asesor/a' }))
    const barbero = within(screen.getByRole('region', { name: 'Tu barbero' }))
    expect(asesor.getByRole('heading', { name: 'Camila' })).toBeInTheDocument()
    expect(asesor.queryByRole('heading', { name: 'Boby' })).toBeNull()
    expect(barbero.getByRole('heading', { name: 'Boby' })).toBeInTheDocument()
    expect(barbero.queryByRole('heading', { name: 'Camila' })).toBeNull()
    expect(within(screen.getByRole('list', { name: /progreso de la reserva/i })).getByText('Profesionales')).toBeInTheDocument()

    await user.click(asesor.getByRole('button', { name: /Camila/ }))
    await user.click(barbero.getByRole('button', { name: /Boby/ }))
    expect(asesor.getByRole('button', { name: /Camila/ })).toHaveAttribute('aria-pressed', 'true')
    expect(asesor.getByRole('button', { name: /Cualquier asesor/ })).toHaveAttribute('aria-pressed', 'false')
    expect(barbero.getByRole('button', { name: /Boby/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Fecha y hora con asesor= y barbero=', () => {
  it('asesoría + barbería con ambos elegidos: pide la disponibilidad con barbero y asesor', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`)
    await esperarCarga()
    await clickContinuar(user)
    await user.click(within(await screen.findByRole('region', { name: 'Tu asesor/a' })).getByRole('button', { name: /Camila/ }))
    await user.click(within(screen.getByRole('region', { name: 'Tu barbero' })).getByRole('button', { name: /Boby/ }))
    await clickContinuar(user)
    await elegirFechaYHora(user)

    expect(api.obtenerDisponibilidad).toHaveBeenLastCalledWith([PREMIUM_API.id, CORTE.id], expect.any(String), BARBERO_1.id, ASESORA.id)
  })

  it('"Cualquier asesor" no envía asesor; solo asesoría no envía barbero aunque hubiera uno elegido antes', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}&barbero=${BARBERO_2.id}`)
    await esperarCarga()
    await clickContinuar(user)
    await clickContinuar(user)
    await elegirFechaYHora(user)
    expect(api.obtenerDisponibilidad).toHaveBeenLastCalledWith([PREMIUM_API.id, CORTE.id], expect.any(String), BARBERO_2.id)

    // Quitar el corte: la reserva es solo de asesoría y el barbero que había en la URL ya no viaja.
    await user.click(screen.getAllByRole('button', { name: /^atrás$/i })[0])
    await user.click(screen.getAllByRole('button', { name: /^atrás$/i })[0])
    await user.click(tarjeta('Corte clásico'))
    await clickContinuar(user)
    await clickContinuar(user)
    await elegirFechaYHora(user)
    expect(api.obtenerDisponibilidad).toHaveBeenLastCalledWith([PREMIUM_API.id], expect.any(String), null)
  })

  it('en una combinada explica que las horas son las de la asesoría y que el corte empieza al terminar, con los horarios', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`)
    await esperarCarga()
    await clickContinuar(user)
    await clickContinuar(user)

    expect(await screen.findByRole('heading', { name: 'Elige la hora de tu asesoría' })).toBeInTheDocument()
    expect(screen.getByText(/empieza justo cuando ella termina/)).toBeInTheDocument()
    await elegirFechaYHora(user, '10:00')
    expect(await screen.findByText('Asesoría: 10:00 – 11:00')).toBeInTheDocument()
    expect(screen.getByText('Barbería: 11:00 – 11:30')).toBeInTheDocument()

    // El resumen lateral también muestra los dos horarios y los dos profesionales.
    const resumen = within(screen.getByRole('complementary', { name: /resumen de la reserva/i }))
    expect(resumen.getByText('10:00 – 11:00')).toBeInTheDocument()
    expect(resumen.getByText('11:00 – 11:30')).toBeInTheDocument()
    expect(resumen.getByText('Cualquier asesor')).toBeInTheDocument()
    expect(resumen.getByText('Cualquier barbero')).toBeInTheDocument()
  })

  it('una reserva de un solo tipo no muestra esa explicación', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${PREMIUM_API.id}`)
    await esperarCarga()
    await clickContinuar(user)
    await clickContinuar(user)
    expect(await screen.findByRole('heading', { name: 'Elige una hora' })).toBeInTheDocument()
    expect(screen.queryByText(/empieza justo cuando ella termina/)).toBeNull()
  })
})

describe('Confirmación y éxito', () => {
  it('asesoría + barbería: el modal muestra una sección por cita, envía asesor_id y barbero_id y el éxito muestra las dos citas', async () => {
    const user = userEvent.setup()
    api.crearCita.mockResolvedValueOnce({ reserva_id: 'r-1', citas: [CITA_ASESORIA, CITA_CORTE] })
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`)
    await esperarCarga()
    await clickContinuar(user)
    await user.click(within(await screen.findByRole('region', { name: 'Tu asesor/a' })).getByRole('button', { name: /Camila/ }))
    await user.click(within(screen.getByRole('region', { name: 'Tu barbero' })).getByRole('button', { name: /Boby/ }))
    await clickContinuar(user)
    await elegirFechaYHora(user)
    await clickContinuar(user)

    const modal = within(await screen.findByRole('dialog'))
    const asesoria = within(modal.getByRole('region', { name: 'Asesoría' }))
    const barberia = within(modal.getByRole('region', { name: 'Barbería' }))
    expect(asesoria.getByRole('heading', { name: 'Asesoría · 10:00 – 11:00' })).toBeInTheDocument()
    expect(asesoria.getByText('Camila')).toBeInTheDocument()
    expect(barberia.getByRole('heading', { name: 'Barbería · 11:00 – 11:30' })).toBeInTheDocument()
    expect(barberia.getByText('Boby')).toBeInTheDocument()
    expect(modal.getByText('$80.000')).toBeInTheDocument()

    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('heading', { name: '¡Citas agendadas con éxito!' })).toBeInTheDocument()
    expect(api.crearCita).toHaveBeenCalledWith(
      expect.objectContaining({
        servicios_ids: [PREMIUM_API.id, CORTE.id],
        asesor_id: ASESORA.id,
        barbero_id: BARBERO_1.id,
        hora: '10:00',
      })
    )
    const exito1 = within(screen.getByRole('region', { name: 'Asesoría' }))
    const exito2 = within(screen.getByRole('region', { name: 'Barbería' }))
    expect(exito1.getByRole('heading', { name: 'Asesoría · 10:00 – 11:00' })).toBeInTheDocument()
    expect(exito1.getByText('Camila')).toBeInTheDocument()
    expect(exito2.getByRole('heading', { name: 'Barbería · 11:00 – 11:30' })).toBeInTheDocument()
    expect(exito2.getByText('Boby')).toBeInTheDocument()
    expect(screen.getByText('$80.000')).toBeInTheDocument() // total combinado
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('solo asesoría: envía asesor_id (sin barbero_id), con "Asesor/a" en el modal y en el éxito (cita plana)', async () => {
    const user = userEvent.setup()
    api.crearCita.mockResolvedValueOnce(CITA_ASESORIA)
    montar(`/reservar-corte?servicios=${PREMIUM_API.id}`)
    await esperarCarga()
    await clickContinuar(user)
    await user.click(await screen.findByRole('button', { name: /Camila/ }))
    await clickContinuar(user)
    await elegirFechaYHora(user)
    await clickContinuar(user)

    const modal = within(await screen.findByRole('dialog'))
    expect(modal.getByText('Asesor/a')).toBeInTheDocument()
    expect(modal.getByText('Camila')).toBeInTheDocument()
    expect(modal.queryByText('Barbero')).toBeNull()
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    const llamada = api.crearCita.mock.calls[0][0]
    expect(llamada).toMatchObject({ servicios_ids: [PREMIUM_API.id], asesor_id: ASESORA.id })
    expect(llamada.barbero_id).toBeUndefined()
    expect(screen.getByText('Asesor/a')).toBeInTheDocument()
    expect(screen.getByText('Camila')).toBeInTheDocument()
    expect(screen.getByText('Bloque 10–11 · tu cita es a las 10:00')).toBeInTheDocument()
  })

  it('solo barbería: el payload no lleva asesor_id y todo es como siempre', async () => {
    const user = userEvent.setup()
    api.crearCita.mockResolvedValueOnce({ ...CITA_CORTE, hora: '10:00:00' })
    montar(`/reservar-corte?servicios=${CORTE.id}`)
    await screen.findByRole('button', { name: /Corte clásico/ })
    await clickContinuar(user)
    await clickContinuar(user)
    await elegirFechaYHora(user)
    await clickContinuar(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(api.crearCita.mock.calls[0][0].asesor_id).toBeUndefined()
    expect(screen.getByText('Barbero')).toBeInTheDocument()
  })
})

describe('Errores con mensajes claros', () => {
  const llegarYConfirmar = async (user, ruta, error) => {
    api.crearCita.mockRejectedValueOnce(error)
    montar(ruta)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
  }
  const errorApi = (mensaje, status, codigo) => Object.assign(new Error(mensaje), { status, codigo })

  it('PROFESIONAL_INCOMPATIBLE al confirmar: vuelve al paso de profesionales con un mensaje, sin pantalla en blanco', async () => {
    const user = userEvent.setup()
    await llegarYConfirmar(user, `/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`, errorApi('x', 400, 'PROFESIONAL_INCOMPATIBLE'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige de nuevo a tu profesional')
    expect(await screen.findByRole('region', { name: 'Tu asesor/a' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('LIMITE_ASESORIAS al confirmar: vuelve al paso Servicio con el motivo', async () => {
    const user = userEvent.setup()
    await llegarYConfirmar(user, `/reservar-corte?servicios=${PREMIUM_API.id}`, errorApi('x', 400, 'LIMITE_ASESORIAS'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo puedes reservar una asesoría a la vez')
    expect(await screen.findByRole('heading', { name: /Añadir una asesoría/ })).toBeInTheDocument()
  })

  it('LIMITE_ASESORIAS y PROFESIONAL_INCOMPATIBLE al pedir horas también se manejan', async () => {
    const user = userEvent.setup()
    api.obtenerDisponibilidad.mockRejectedValueOnce(errorApi('x', 400, 'PROFESIONAL_INCOMPATIBLE'))
    montar(`/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`)
    await esperarCarga()
    await clickContinuar(user)
    await clickContinuar(user)
    const fechas = await screen.findByRole('group', { name: /fechas disponibles/i })
    await user.click(within(fechas).getAllByRole('button')[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige de nuevo a tu profesional')
    expect(await screen.findByRole('region', { name: 'Tu barbero' })).toBeInTheDocument()
  })

  it('conflicto de horario (409): vuelve a Fecha y hora y refresca la disponibilidad', async () => {
    const user = userEvent.setup()
    await llegarYConfirmar(user, `/reservar-corte?servicios=${PREMIUM_API.id},${CORTE.id}`, errorApi('Ese horario ya está reservado', 409))
    // MODIFICADO: el 409 reasigna la siguiente hora libre del mismo bloque y avisa (status) en vez de una alerta.
    expect(await screen.findByText(/te asignamos las 10:30/i)).toBeInTheDocument()
    await waitFor(() => expect(api.obtenerDisponibilidad.mock.calls.length).toBeGreaterThanOrEqual(2))
  })
})

describe('Asesoría gratuita: una por persona', () => {
  const rutaGratis = `/reservar-corte?servicios=${GRATIS_API.id}`
  const rutaGratisYCorte = `/reservar-corte?servicios=${GRATIS_API.id},${CORTE.id}`
  const ya409 = () => Object.assign(new Error('Ya usaste tu asesoría gratis'), { status: 409, codigo: 'ASESORIA_GRATIS_YA_USADA', servicio_id: GRATIS_API.id })

  it('comprobar → disponible: false: aviso accesible, sin decir qué dato coincidió, confirmar bloqueado y dos botones de 44 px', async () => {
    const user = userEvent.setup()
    api.comprobarAsesoriaGratis.mockResolvedValue({ disponible: false })
    montar(rutaGratis)
    await llegarAlModal(user)
    await llenarContacto(user)

    const aviso = await screen.findByText(/Ya usaste tu asesoría gratuita/, {}, { timeout: 3000 })
    const estado = aviso.closest('[role="status"]')
    expect(estado).toHaveAttribute('aria-live', 'polite')
    expect(aviso.textContent).not.toMatch(/correo|teléfono|telefono|mail/i)
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toHaveAttribute('aria-describedby', aviso.id)
    for (const nombre of ['Quitar asesoría gratuita', 'Elegir otra asesoría']) {
      expect(screen.getByRole('button', { name: nombre })).toHaveClass('min-h-11')
    }
    expect(api.crearCita).not.toHaveBeenCalled()
  })

  it('pregunta con espera (una sola llamada con los datos finales) y solo cuando correo y teléfono son válidos', async () => {
    const user = userEvent.setup()
    montar(rutaGratis)
    await llegarAlModal(user)

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
    await user.type(screen.getByLabelText('Teléfono'), '300')
    await new Promise((resolver) => setTimeout(resolver, 800))
    expect(api.comprobarAsesoriaGratis).not.toHaveBeenCalled() // teléfono incompleto

    await user.type(screen.getByLabelText('Teléfono'), '1234567')
    await waitFor(() => expect(api.comprobarAsesoriaGratis).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(api.comprobarAsesoriaGratis).toHaveBeenCalledWith('ana@example.com', '3001234567', expect.any(AbortSignal))
  })

  it('si la reserva no incluye la gratis, no se llama a comprobar', async () => {
    const user = userEvent.setup()
    montar(`/reservar-corte?servicios=${PREMIUM_API.id}`)
    await llegarAlModal(user)
    await llenarContacto(user)
    await new Promise((resolver) => setTimeout(resolver, 800))
    expect(api.comprobarAsesoriaGratis).not.toHaveBeenCalled()
  })

  it.each([
    ['falla la red', Object.assign(new Error('No se pudo conectar con el servidor'), { red: true })],
    ['límite de intentos (429)', Object.assign(new Error('Demasiadas comprobaciones'), { status: 429, codigo: 'DEMASIADOS_INTENTOS' })],
    ['error del servidor (500)', Object.assign(new Error('boom'), { status: 500 })],
  ])('si comprobar falla (%s) NO bloquea: se puede confirmar y decide el POST', async (_n, error) => {
    const user = userEvent.setup()
    api.comprobarAsesoriaGratis.mockRejectedValue(error)
    api.crearCita.mockResolvedValueOnce({ ...CITA_ASESORIA, servicio_id: GRATIS_API.id, precio: 0 })
    montar(rutaGratis)
    await llegarAlModal(user)
    await llenarContacto(user)
    await waitFor(() => expect(api.comprobarAsesoriaGratis).toHaveBeenCalled(), { timeout: 3000 })

    expect(screen.queryByText(/Ya usaste tu asesoría gratuita/)).toBeNull()
    const confirmar = screen.getByRole('button', { name: /confirmar reserva/i })
    expect(confirmar).toBeEnabled()
    await user.click(confirmar)
    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
  })

  it('el POST responde 409 ASESORIA_GRATIS_YA_USADA: mismo aviso y mismas acciones; no se confirma nada', async () => {
    const user = userEvent.setup()
    api.crearCita.mockRejectedValueOnce(ya409())
    montar(rutaGratis)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    const aviso = await screen.findByText(/Ya usaste tu asesoría gratuita/)
    expect(aviso.textContent).not.toMatch(/correo|teléfono|telefono|mail/i)
    expect(screen.getByRole('button', { name: 'Quitar asesoría gratuita' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir otra asesoría' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeDisabled()
    expect(screen.queryByText(/¡cita agendada con éxito!/i)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull() // no es un error técnico
    expect(api.crearCita).toHaveBeenCalledTimes(1)
  })

  it('tras el 409, cambiar los datos retira el aviso y permite reintentar', async () => {
    const user = userEvent.setup()
    api.crearCita.mockRejectedValueOnce(ya409()).mockResolvedValueOnce({ ...CITA_ASESORIA, precio: 0 })
    montar(rutaGratis)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await screen.findByText(/Ya usaste tu asesoría gratuita/)

    await user.type(screen.getByLabelText('Correo electrónico'), 'x')
    await waitFor(() => expect(screen.queryByText(/Ya usaste tu asesoría gratuita/)).toBeNull())
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(api.crearCita).toHaveBeenCalledTimes(2)
  })

  it('"Quitar asesoría gratuita" cuando era lo único: vuelve a elegir servicios, con aviso y la gratis fuera', async () => {
    const user = userEvent.setup()
    api.crearCita.mockRejectedValueOnce(ya409())
    montar(rutaGratis)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await user.click(await screen.findByRole('button', { name: 'Quitar asesoría gratuita' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('alert')).toHaveTextContent('Quitamos la asesoría gratuita. Elige un servicio para continuar')
    expect(tarjeta('Asesoría de imagen gratis')).toHaveAttribute('aria-pressed', 'false')
    expect(botonesContinuar().every((b) => b.disabled)).toBe(true)
  })

  it('"Quitar asesoría gratuita" en una combinada: sigue la reserva con el corte y se vuelve a elegir la hora', async () => {
    const user = userEvent.setup()
    api.comprobarAsesoriaGratis.mockResolvedValue({ disponible: false })
    montar(rutaGratisYCorte)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(await screen.findByRole('button', { name: 'Quitar asesoría gratuita' }, { timeout: 3000 }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige de nuevo la hora')
    expect(await screen.findByRole('heading', { name: 'Elige una hora' })).toBeInTheDocument() // ya no es combinada
    const resumen = within(screen.getByRole('complementary', { name: /resumen de la reserva/i }))
    expect(resumen.getByText('Corte clásico')).toBeInTheDocument()
    expect(resumen.queryByText(/asesoría/i)).toBeNull()
    // Sin hora elegida: no se puede avanzar hasta elegir una de nuevo.
    expect(botonesContinuar().every((b) => b.disabled)).toBe(true)
  })

  it('"Elegir otra asesoría": vuelve al bloque de asesorías (con el foco ahí), sin la gratis y con las demás disponibles', async () => {
    const user = userEvent.setup()
    api.crearCita.mockRejectedValueOnce(ya409())
    montar(rutaGratisYCorte)
    await llegarAlModal(user)
    await llenarContacto(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await user.click(await screen.findByRole('button', { name: 'Elegir otra asesoría' }))

    const titulo = await screen.findByRole('heading', { name: /Añadir una asesoría/ })
    await waitFor(() => expect(titulo).toHaveFocus())
    expect(screen.getByRole('alert')).toHaveTextContent('Elige otra asesoría o continúa sin ella')
    expect(tarjeta('Asesoría de imagen gratis')).toHaveAttribute('aria-pressed', 'false')
    expect(tarjeta('Corte clásico')).toHaveAttribute('aria-pressed', 'true') // el corte sigue elegido
    await user.click(tarjeta('Asesoría Premium'))
    expect(tarjeta('Asesoría Premium')).toHaveAttribute('aria-pressed', 'true')
  })

  it('no hay forma de confirmar con la gratis mientras el aviso está activo (ni con Enter en el formulario)', async () => {
    const user = userEvent.setup()
    api.comprobarAsesoriaGratis.mockResolvedValue({ disponible: false })
    montar(rutaGratis)
    await llegarAlModal(user)
    await llenarContacto(user)
    await screen.findByText(/Ya usaste tu asesoría gratuita/, {}, { timeout: 3000 })
    await user.type(screen.getByLabelText('Nombre'), '{Enter}')
    expect(api.crearCita).not.toHaveBeenCalled()
  })
})

describe('Asesoría creada por el admin (sin clave)', () => {
  it('sí se ofrece en "Añadir una asesoría" de la reserva', async () => {
    vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue([
      ...ASESORIAS_API,
      { id: 500, nombre: 'Asesoría del admin', descripcion: 'x', precio: 30000, duracion_min: 30, tipo: 'original', categoria: { id: 9, nombre: 'Asesorías', slug: 'asesorias' } },
    ])
    montar()
    await esperarCarga()
    expect(tarjeta('Asesoría del admin')).toHaveAttribute('aria-pressed', 'false')
    expect(tarjeta('Asesoría Premium')).toBeInTheDocument()
  })
})
