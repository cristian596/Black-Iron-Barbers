import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import * as api from '../services/api'
import { formatearFechaLegible, hoyISO } from '../utils/fechas'

vi.mock('../services/api')

// Las páginas se cargan con React.lazy: margen de espera para la suite completa.
const ESPERA = 10_000
const ESPERA_TEST = 20_000

const VIGENTE = { estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' }

const sesion = (rol = 'barbero') => {
  const payload = { id: 1, usuario: rol === 'barbero' ? 'leo' : 'admin', rol, barbero_id: rol === 'barbero' ? 2 : null, exp: Math.floor(Date.now() / 1000) + 3600 }
  localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
}

const fijarEscritorio = (esEscritorio) => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: esEscritorio, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

const RESUMEN = {
  fecha: hoyISO(), citas_hoy: 3, completadas_hoy: 1, pendientes_hoy: 2,
  proxima_cita: { id: 11, cliente: 'Ana Gómez', servicio_nombre: 'Corte clásico', fecha: hoyISO(), hora: '15:30:00' },
  ingresos_hoy: 45000, cortes_mes: 12, ingresos_mes: 540000, por_confirmar: 0,
}
const agendaCita = (id, extra = {}) => ({
  id, cliente: `Cliente ${id}`, servicio_nombre: 'Corte clásico', fecha: hoyISO(), hora: '10:00:00', estado: 'pendiente',
  duracion_min: 30, precio: 40000, por_confirmar: false, ...extra,
})
const vencida = (id, extra = {}) => ({
  id, cliente: `Vencida ${id}`, servicio_nombre: 'Barba', fecha: '2026-09-28', hora: '11:00:00', duracion_min: 30,
  termino_hace_min: 3000, vencida_hace_min: 2880, ...extra,
})

// Datos "del servidor" que cada prueba puede cambiar; los mocks leen siempre el valor vigente.
let servidor
const reiniciarServidor = () => {
  servidor = {
    resumen: { ...RESUMEN },
    porConfirmar: { total: 0, tope: 100, items: [] },
    agenda: { fecha: hoyISO(), citas: [agendaCita(1, { hora: '09:00:00', estado: 'completada' }), agendaCita(2, { hora: '15:30:00' })] },
  }
}

let router
const montar = (ruta = '/panel') => {
  router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
const esperarPanel = () => screen.findByRole('heading', { level: 1, name: /Hola, Leo/ }, { timeout: ESPERA })
const ruta = () => router.state.location.pathname + router.state.location.hash

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  sesion()
  fijarEscritorio(true)
  reiniciarServidor()
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 2, nombre: 'Leo', cargo: 'Barbero Senior', foto: null }])
  vi.mocked(api.obtenerSesion).mockResolvedValue({ usuario: {}, vigencia: VIGENTE })
  vi.mocked(api.obtenerResumenBarbero).mockImplementation(async () => structuredClone(servidor.resumen))
  vi.mocked(api.obtenerCitasPorConfirmar).mockImplementation(async () => structuredClone(servidor.porConfirmar))
  vi.mocked(api.obtenerAgendaHoy).mockImplementation(async () => structuredClone(servidor.agenda))
  vi.mocked(api.actualizarCita).mockResolvedValue({})
})

afterEach(() => {
  delete window.matchMedia
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// Pone al barbero con citas por confirmar (de días anteriores) y activa el aviso.
const conPorConfirmar = (items) => {
  servidor.porConfirmar = { total: items.length, tope: 100, items }
  servidor.resumen = { ...servidor.resumen, por_confirmar: items.length }
}
// Cierra la ventana de bienvenida si salió (la mayoría de pruebas no la necesita).
const sinBienvenida = () => sessionStorage.setItem('bienvenida-barbero-vista', '1')

describe('Layout de /panel', () => {
  it('barra lateral con avatar, nombre y cargo del barbero y las cuatro entradas del menú', async () => {
    sinBienvenida()
    montar()
    await esperarPanel()
    const lateral = screen.getByRole('complementary', { name: 'Menú de navegación' })

    expect(within(lateral).getByText('Barbero Senior')).toBeInTheDocument()
    expect(within(lateral).getByRole('img', { name: 'Avatar de Leo' })).toBeInTheDocument() // sin foto: iniciales
    const enlaces = within(within(lateral).getByRole('navigation')).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])
    expect(enlaces).toEqual([
      ['Resumen', '/panel'], ['Mis citas', '/panel/citas'], ['Mi rendimiento', '/panel/rendimiento'], ['Mi cuenta', '/panel/cuenta'],
    ])
  })

  it('el menú de usuario solo ofrece "Cerrar sesión" (el barbero ya no cambia su contraseña libremente)', async () => {
    sinBienvenida()
    montar()
    await esperarPanel()
    await userEvent.click(screen.getByRole('button', { name: /Menú de usuario/ }))
    const menu = document.getElementById('menu-usuario')

    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cerrar sesión'])
    expect(screen.queryByText(/cambiar contraseña/i)).toBeNull()
    await userEvent.click(within(menu).getByRole('button', { name: 'Cerrar sesión' }))
    expect(ruta()).not.toBe('/acceso')
    await userEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(ruta()).toBe('/acceso'))
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('una ruta desconocida bajo /panel vuelve a /panel', async () => {
    sinBienvenida()
    montar('/panel/no-existe')
    await esperarPanel()
    expect(ruta()).toBe('/panel')
  })

  it('/panel/citas (Mis citas) carga dentro del mismo layout, y completar refresca el resumen compartido', async () => {
    sinBienvenida()
    vi.mocked(api.obtenerMisCitas).mockResolvedValue({
      items: [{ id: 5, cliente: 'Pedro Pérez', servicio_nombre: 'Barba', duracion_min: 30, precio: 20000, fecha: hoyISO(), hora: '10:00:00', estado: 'pendiente', por_confirmar: false }],
      pagina: 1, limite: 15, total: 1, conteos: { hoy: 1, proximas: 0, por_confirmar: 0, completadas: 0, canceladas: 0, todas: 1 },
    })
    montar('/panel/citas')
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis citas' }, { timeout: ESPERA })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Menú de navegación' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mis citas' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(await screen.findByRole('button', { name: 'Completar la cita de Pedro Pérez' }))
    expect(api.actualizarCita).toHaveBeenCalledWith(expect.any(String), 5, { estado: 'completada' })
    // el resumen compartido se vuelve a pedir para que el aviso de "por confirmar" se actualice
    await waitFor(() => expect(vi.mocked(api.obtenerResumenBarbero).mock.calls.length).toBeGreaterThan(1))
  }, ESPERA_TEST)

  it('guard: sin sesión va a /acceso y un admin no entra a /panel', async () => {
    localStorage.clear()
    montar('/panel')
    await waitFor(() => expect(ruta()).toBe('/acceso'))
  })

  it('guard: un admin que abre /panel vuelve a /admin', async () => {
    localStorage.clear()
    sesion('admin')
    api.obtenerEstadisticas.mockResolvedValue({})
    montar('/panel')
    await waitFor(() => expect(ruta()).toBe('/admin'), { timeout: ESPERA })
  })

  it('en móvil el menú es un cajón accesible: abre con el botón, atrapa el foco y Escape lo cierra', async () => {
    sinBienvenida()
    fijarEscritorio(false)
    montar()
    await esperarPanel()
    const abrir = screen.getByRole('button', { name: 'Abrir menú' })
    await userEvent.click(abrir)

    const cajon = screen.getByRole('dialog', { name: 'Menú de navegación' })
    expect(cajon).toHaveAttribute('aria-modal', 'true')
    expect(cajon.contains(document.activeElement)).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(abrir).toHaveFocus()
  })

  it('la ventana de bienvenida y el aviso de por confirmar no existen en /admin', async () => {
    localStorage.clear()
    sesion('admin')
    conPorConfirmar([vencida(1)])
    api.obtenerEstadisticas.mockResolvedValue({})
    montar('/admin')
    await screen.findByRole('complementary', { name: 'Menú de navegación' }, { timeout: ESPERA })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/No has confirmado/)).toBeNull()
    expect(api.obtenerResumenBarbero).not.toHaveBeenCalled()
  })
})

describe('Resumen', () => {
  beforeEach(sinBienvenida)

  it('encabezado con el nombre y la fecha de hoy (Bogotá) y las cuatro tarjetas', async () => {
    montar()
    await esperarPanel()
    const fecha = formatearFechaLegible(hoyISO())
    expect(screen.getByText(fecha.charAt(0).toUpperCase() + fecha.slice(1))).toBeInTheDocument()

    const cifras = await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })
    expect(within(cifras).getByText('Citas hoy').parentElement).toHaveTextContent('3')
    expect(within(cifras).getByText('Citas hoy').parentElement).toHaveTextContent('1 completada')
    expect(within(cifras).getByText('Ingresos hoy').parentElement).toHaveTextContent('$45.000')
    expect(within(cifras).getByText('Cortes del mes').parentElement).toHaveTextContent('12')
    expect(within(cifras).getByText('Cortes del mes').parentElement).toHaveTextContent('$540.000 en ingresos')
    expect(within(cifras).getByText('Próxima cita').parentElement).toHaveTextContent('15:30')
    expect(within(cifras).getByText('Próxima cita').parentElement).toHaveTextContent('Ana Gómez · Corte clásico')
  }, ESPERA_TEST)

  it('ingresos en cero se muestran como $0 (un total, no un precio: nunca "Gratis")', async () => {
    servidor.resumen = { ...RESUMEN, ingresos_hoy: 0, ingresos_mes: 0, cortes_mes: 0, completadas_hoy: 0 }
    montar()
    const cifras = await screen.findByRole('region', { name: 'Cifras de hoy y del mes' }, { timeout: ESPERA })
    expect(within(cifras).getByText('Ingresos hoy').parentElement).toHaveTextContent('$0')
    expect(cifras).not.toHaveTextContent('Gratis')
  })

  it('la próxima cita de otro día muestra su fecha; sin próxima cita dice "Sin citas próximas"', async () => {
    servidor.resumen = { ...RESUMEN, proxima_cita: { ...RESUMEN.proxima_cita, fecha: '2030-06-15' } }
    const { unmount } = montar()
    const cifras = await screen.findByRole('region', { name: 'Cifras de hoy y del mes' }, { timeout: ESPERA })
    expect(within(cifras).getByText('Próxima cita').parentElement).toHaveTextContent('15/06/2030')
    unmount()

    servidor.resumen = { ...RESUMEN, proxima_cita: null }
    montar()
    expect(await screen.findByText('Sin citas próximas', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('agenda de hoy por hora con estado, servicio, duración, "Por confirmar" y acciones solo en las pendientes', async () => {
    servidor.agenda = {
      fecha: hoyISO(),
      citas: [
        agendaCita(1, { hora: '09:00:00', estado: 'completada' }),
        agendaCita(2, { hora: '10:00:00', por_confirmar: true }),
        agendaCita(3, { hora: '16:00:00', estado: 'cancelada' }),
        agendaCita(4, { hora: '17:00:00', precio: 0 }),
      ],
    }
    montar()
    const agenda = await screen.findByRole('region', { name: 'Agenda de hoy' }, { timeout: ESPERA })
    const filas = await within(agenda).findAllByRole('listitem')

    expect(filas).toHaveLength(4)
    expect(filas[0]).toHaveTextContent('09:00')
    expect(filas[0]).toHaveTextContent('Completada')
    expect(filas[0]).toHaveTextContent('Corte clásico · 30 min · $40.000')
    expect(within(filas[0]).queryByRole('button')).toBeNull()
    expect(filas[1]).toHaveTextContent('Por confirmar')
    expect(filas[1]).toHaveTextContent('Pendiente')
    expect(within(filas[1]).getByRole('button', { name: 'Completar la cita de Cliente 2' })).toBeInTheDocument()
    expect(within(filas[1]).getByRole('button', { name: 'Cancelar la cita de Cliente 2' })).toBeInTheDocument()
    expect(filas[2]).toHaveTextContent('Cancelada')
    expect(within(filas[2]).queryByRole('button')).toBeNull()
    expect(filas[3]).toHaveTextContent('Gratis') // el precio de una cita sí es un precio
    expect(filas[3]).not.toHaveTextContent('Por confirmar')
  }, ESPERA_TEST)

  it('agenda vacía: "Hoy no tienes citas agendadas."', async () => {
    servidor.agenda = { fecha: hoyISO(), citas: [] }
    montar()
    expect(await screen.findByText('Hoy no tienes citas agendadas.', {}, { timeout: ESPERA })).toBeInTheDocument()
  })

  it('sección Por confirmar: de la más antigua a la más reciente, con el tiempo vencido y "mostrando N de TOTAL"', async () => {
    servidor.porConfirmar = {
      total: 150, tope: 100,
      items: [vencida(1, { vencida_hace_min: 2880 }), vencida(2, { vencida_hace_min: 200, fecha: '2026-10-03' }), vencida(3, { vencida_hace_min: 40, fecha: '2026-10-04' })],
    }
    servidor.resumen = { ...RESUMEN, por_confirmar: 150 }
    montar()
    const seccion = await screen.findByRole('region', { name: 'Por confirmar' }, { timeout: ESPERA })
    const filas = await within(seccion).findAllByRole('listitem')

    expect(filas.map((f) => f.textContent.match(/Vencida \d/)[0])).toEqual(['Vencida 1', 'Vencida 2', 'Vencida 3'])
    expect(filas[0]).toHaveTextContent('Vencida hace 2 días')
    expect(filas[1]).toHaveTextContent('Vencida hace 3 h')
    expect(filas[2]).toHaveTextContent('Vencida hace 40 min')
    expect(filas[0]).toHaveTextContent('Barba · 28/09/2026 · 11:00')
    expect(within(filas[0]).getByRole('button', { name: /Completar/ })).toBeInTheDocument()
    expect(within(seccion).getByText(/Mostrando 3 de 150 citas por confirmar/)).toBeInTheDocument()
  }, ESPERA_TEST)

  it('sin citas por confirmar, la sección lo dice con claridad', async () => {
    montar()
    expect(await screen.findByText('No tienes citas por confirmar. Todo está al día.', {}, { timeout: ESPERA })).toBeInTheDocument()
  })

  it('mientras carga muestra esqueletos con aviso de estado, no una pantalla vacía', async () => {
    vi.mocked(api.obtenerResumenBarbero).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.obtenerAgendaHoy).mockReturnValue(new Promise(() => {}))
    montar()
    await esperarPanel()
    expect(screen.getByText('Cargando tu resumen...')).toBeInTheDocument()
    expect(screen.getByText('Cargando tu agenda de hoy...')).toBeInTheDocument()
  })

  it('error: ErrorCarga con "Reintentar" que vuelve a pedir y muestra los datos', async () => {
    vi.mocked(api.obtenerResumenBarbero).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    montar()
    const alerta = (await screen.findByText('No pudimos cargar tu resumen.', {}, { timeout: ESPERA })).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('error en la agenda: mensaje y "Reintentar" propios', async () => {
    vi.mocked(api.obtenerAgendaHoy).mockRejectedValueOnce(new Error('fallo'))
    montar()
    const alerta = (await screen.findByText('No pudimos cargar tu agenda de hoy.', {}, { timeout: ESPERA })).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Cliente 2')).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('Completar y cancelar desde el Resumen', () => {
  beforeEach(sinBienvenida)

  it('completar usa PATCH /api/citas/:id y recarga resumen, agenda y por confirmar', async () => {
    montar()
    const agenda = await screen.findByRole('region', { name: 'Agenda de hoy' }, { timeout: ESPERA })
    await within(agenda).findByText('Cliente 2')
    const antes = vi.mocked(api.obtenerResumenBarbero).mock.calls.length
    const antesAgenda = vi.mocked(api.obtenerAgendaHoy).mock.calls.length

    servidor.agenda.citas[1].estado = 'completada'
    await userEvent.click(within(agenda).getByRole('button', { name: 'Completar la cita de Cliente 2' }))

    expect(api.actualizarCita).toHaveBeenCalledWith(expect.any(String), 2, { estado: 'completada' })
    await waitFor(() => expect(vi.mocked(api.obtenerResumenBarbero).mock.calls.length).toBe(antes + 1))
    await waitFor(() => expect(vi.mocked(api.obtenerAgendaHoy).mock.calls.length).toBe(antesAgenda + 1))
    expect(api.obtenerCitasPorConfirmar.mock.calls.length).toBe(antes + 1)
  }, ESPERA_TEST)

  it('si el back-end responde CITA_FUTURA u otro error, el mensaje se ve en pantalla y no se recarga', async () => {
    vi.mocked(api.actualizarCita).mockRejectedValue(Object.assign(new Error('No se puede completar una cita de una fecha futura'), { codigo: 'CITA_FUTURA' }))
    montar()
    const agenda = await screen.findByRole('region', { name: 'Agenda de hoy' }, { timeout: ESPERA })
    await within(agenda).findByText('Cliente 2')
    const antes = vi.mocked(api.obtenerResumenBarbero).mock.calls.length

    await userEvent.click(within(agenda).getByRole('button', { name: 'Completar la cita de Cliente 2' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la cita de Cliente 2: No se puede completar una cita de una fecha futura')
    expect(vi.mocked(api.obtenerResumenBarbero).mock.calls.length).toBe(antes)
  }, ESPERA_TEST)

  it('cancelar pide confirmación con un diálogo propio (no window.confirm) y solo cancela al confirmar', async () => {
    const confirmar = vi.spyOn(window, 'confirm')
    montar()
    const agenda = await screen.findByRole('region', { name: 'Agenda de hoy' }, { timeout: ESPERA })
    await within(agenda).findByText('Cliente 2')

    await userEvent.click(within(agenda).getByRole('button', { name: 'Cancelar la cita de Cliente 2' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('¿Seguro que quieres cancelar la cita de Cliente 2')
    expect(api.actualizarCita).not.toHaveBeenCalled()

    // "Cancelar" del diálogo = no hacer nada
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.actualizarCita).not.toHaveBeenCalled()

    await userEvent.click(within(agenda).getByRole('button', { name: 'Cancelar la cita de Cliente 2' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }))
    expect(api.actualizarCita).toHaveBeenCalledWith(expect.any(String), 2, { estado: 'cancelada' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(confirmar).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it('si cancelar falla, el error aparece dentro del diálogo y se puede reintentar', async () => {
    vi.mocked(api.actualizarCita).mockRejectedValueOnce(new Error('Cita no encontrada'))
    montar()
    const agenda = await screen.findByRole('region', { name: 'Agenda de hoy' }, { timeout: ESPERA })
    await within(agenda).findByText('Cliente 2')
    await userEvent.click(within(agenda).getByRole('button', { name: 'Cancelar la cita de Cliente 2' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Cita no encontrada')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }, ESPERA_TEST)

  it('desde la sección Por confirmar también se completa y se cancela', async () => {
    conPorConfirmar([vencida(7)])
    montar()
    const seccion = await screen.findByRole('region', { name: 'Por confirmar' }, { timeout: ESPERA })
    await userEvent.click(await within(seccion).findByRole('button', { name: 'Completar la cita de Vencida 7' }))
    expect(api.actualizarCita).toHaveBeenCalledWith(expect.any(String), 7, { estado: 'completada' })
  }, ESPERA_TEST)
})

describe('Ventana de bienvenida', () => {
  it('con citas hoy: "Tienes 3 citas para hoy." y la próxima cita; foco dentro, Escape cierra y devuelve el foco', async () => {
    montar()
    const dialogo = await screen.findByRole('dialog', { name: /Hola, Leo/ }, { timeout: ESPERA })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveTextContent('Tienes 3 citas para hoy.')
    expect(dialogo).toHaveTextContent('Tu próxima cita: Ana Gómez, Corte clásico, 15:30.')
    expect(dialogo.contains(document.activeElement)).toBe(true)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('singular: "Tienes 1 cita para hoy."', async () => {
    servidor.resumen = { ...RESUMEN, citas_hoy: 1 }
    montar()
    expect(await screen.findByText('Tienes 1 cita para hoy.', {}, { timeout: ESPERA })).toBeInTheDocument()
  })

  it('sin citas: "Hoy no tienes citas agendadas." y sin próxima cita', async () => {
    servidor.resumen = { ...RESUMEN, citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null }
    montar()
    const dialogo = await screen.findByRole('dialog', {}, { timeout: ESPERA })
    expect(dialogo).toHaveTextContent('Hoy no tienes citas agendadas.')
    expect(dialogo).not.toHaveTextContent('Tu próxima cita')
    expect(within(dialogo).queryByText(/sin confirmar/)).toBeNull()
  })

  it('con citas por confirmar de días anteriores las lista aparte y el botón lleva a esa sección', async () => {
    conPorConfirmar([vencida(1), vencida(2, { fecha: '2026-09-29' }), vencida(3, { fecha: hoyISO(), hora: '08:00:00' })])
    montar()
    const dialogo = await screen.findByRole('dialog', {}, { timeout: ESPERA })

    // la de hoy no es "de días anteriores"
    expect(within(dialogo).getByText('Tienes 2 citas sin confirmar de días anteriores')).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('Vencida 1 · Barba · 28/09/2026 11:00')
    expect(dialogo).not.toHaveTextContent('Vencida 3')

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ver citas sin confirmar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(ruta()).toBe('/panel#por-confirmar'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Por confirmar' })).toHaveFocus())
  }, ESPERA_TEST)

  it('en singular: "Tienes 1 cita sin confirmar de días anteriores"', async () => {
    conPorConfirmar([vencida(1)])
    montar()
    expect(await screen.findByText('Tienes 1 cita sin confirmar de días anteriores', {}, { timeout: ESPERA })).toBeInTheDocument()
  })

  it('sale UNA vez por inicio de sesión: "Entendido" la cierra y recargar la página no la repite', async () => {
    const primera = montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }, { timeout: ESPERA }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sessionStorage.getItem('bienvenida-barbero-vista')).toBe('1')
    primera.unmount()

    montar() // "recarga": mismo sessionStorage
    await esperarPanel()
    await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })
    expect(screen.queryByRole('dialog')).toBeNull()
  }, ESPERA_TEST)

  it('al cerrar sesión se borra la marca y el siguiente inicio de sesión la vuelve a mostrar', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }, { timeout: ESPERA }))
    expect(sessionStorage.getItem('bienvenida-barbero-vista')).toBe('1')

    await userEvent.click(await screen.findByRole('button', { name: /Menú de usuario/ }))
    await userEvent.click(within(document.getElementById('menu-usuario')).getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(ruta()).toBe('/acceso'))
    expect(sessionStorage.getItem('bienvenida-barbero-vista')).toBeNull()

    // vuelve a entrar sin recargar la página
    vi.mocked(api.login).mockResolvedValue({
      token: `x.${btoa(JSON.stringify({ id: 1, usuario: 'leo', rol: 'barbero', barbero_id: 2, exp: Math.floor(Date.now() / 1000) + 3600 }))}.y`,
      usuario: { id: 1, usuario: 'leo', rol: 'barbero', barbero_id: 2 },
      vigencia: VIGENTE,
    })
    await userEvent.type(await screen.findByLabelText('Usuario'), 'leo')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-1')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('dialog', { name: /Hola, Leo/ }, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('si sessionStorage no está disponible no se rompe: la ventana sale (una vez por carga)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((clave) => {
      if (clave === 'bienvenida-barbero-vista') throw new Error('bloqueado')
      return null
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((clave) => {
      if (clave === 'bienvenida-barbero-vista') throw new Error('bloqueado')
    })
    localStorage.clear()
    // sin getItem real, restaurarSesion no encuentra token: se simula la sesión por el contexto
    vi.mocked(Storage.prototype.getItem).mockImplementation((clave) => {
      if (clave === 'bienvenida-barbero-vista') throw new Error('bloqueado')
      return clave === 'token' ? `x.${btoa(JSON.stringify({ id: 1, usuario: 'leo', rol: 'barbero', barbero_id: 2, exp: Math.floor(Date.now() / 1000) + 3600 }))}.y` : null
    })
    montar()
    expect(await screen.findByRole('dialog', { name: /Hola, Leo/ }, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('Aviso persistente de citas por confirmar', () => {
  beforeEach(sinBienvenida)

  it('aparece con el conteo (plural), lleva a Por confirmar y NO se puede cerrar', async () => {
    conPorConfirmar([vencida(1), vencida(2)])
    montar('/panel/citas')
    const aviso = await screen.findByText('No has confirmado 2 citas', {}, { timeout: ESPERA })
    const region = aviso.closest('[role="status"]')
    expect(region).toHaveAttribute('aria-live', 'polite')

    const contenedor = region.parentElement
    expect(within(contenedor).queryByRole('button')).toBeNull() // ningún botón de cerrar
    const enlace = within(contenedor).getByRole('link', { name: 'Confirmar ahora' })
    expect(enlace).toHaveAttribute('href', '/panel#por-confirmar')
    await userEvent.click(enlace)
    await waitFor(() => expect(ruta()).toBe('/panel#por-confirmar'))
    // sigue ahí en la nueva ruta
    expect(screen.getByText('No has confirmado 2 citas')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('singular: "No has confirmado 1 cita"', async () => {
    conPorConfirmar([vencida(1)])
    montar()
    expect(await screen.findByText('No has confirmado 1 cita', {}, { timeout: ESPERA })).toBeInTheDocument()
  })

  it('sin citas por confirmar no hay aviso', async () => {
    montar()
    await screen.findByRole('region', { name: 'Cifras de hoy y del mes' }, { timeout: ESPERA })
    expect(screen.queryByText(/No has confirmado/)).toBeNull()
  })

  it('desaparece solo cuando el conteo llega a 0 tras confirmar o cancelar', async () => {
    conPorConfirmar([vencida(1)])
    montar()
    const seccion = await screen.findByRole('region', { name: 'Por confirmar' }, { timeout: ESPERA })
    expect(await screen.findByText('No has confirmado 1 cita')).toBeInTheDocument()

    conPorConfirmar([]) // el back-end ya no la cuenta
    await userEvent.click(await within(seccion).findByRole('button', { name: 'Completar la cita de Vencida 1' }))
    await waitFor(() => expect(screen.queryByText(/No has confirmado/)).toBeNull())
  }, ESPERA_TEST)

  it('el texto solo cambia cuando cambia el número (no se re-anuncia en cada refresco)', async () => {
    conPorConfirmar([vencida(1), vencida(2)])
    montar()
    const texto = await screen.findByText('No has confirmado 2 citas', {}, { timeout: ESPERA })
    const nodo = texto.firstChild
    const observador = vi.fn()
    new MutationObserver(observador).observe(texto.closest('[role="status"]'), { childList: true, subtree: true, characterData: true })

    // refresco con el mismo conteo
    const antes = vi.mocked(api.obtenerResumenBarbero).mock.calls.length
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(vi.mocked(api.obtenerResumenBarbero).mock.calls.length).toBe(antes + 1))
    await act(async () => {})
    expect(observador).not.toHaveBeenCalled()
    expect(screen.getByText('No has confirmado 2 citas').firstChild).toBe(nodo)
  }, ESPERA_TEST)

  it('en móvil y en escritorio queda por debajo del cajón y los modales (z-20)', async () => {
    conPorConfirmar([vencida(1)])
    montar()
    const aviso = (await screen.findByText('No has confirmado 1 cita', {}, { timeout: ESPERA })).closest('.fixed')
    expect(aviso).toHaveClass('z-20', 'bottom-0')
  })
})

describe('Estado compartido y refresco', () => {
  beforeEach(sinBienvenida)

  it('una sola petición de resumen y de por confirmar al entrar (la comparten bienvenida, aviso y Resumen)', async () => {
    montar()
    await esperarPanel()
    await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })
    expect(api.obtenerResumenBarbero).toHaveBeenCalledTimes(1)
    expect(api.obtenerCitasPorConfirmar).toHaveBeenCalledTimes(1)
  }, ESPERA_TEST)

  it('se refresca cada 60 s mientras la pestaña está visible y no mientras está oculta', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    montar()
    await esperarPanel()
    await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })
    expect(api.obtenerResumenBarbero).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(api.obtenerResumenBarbero).toHaveBeenCalledTimes(2)

    const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { vi.advanceTimersByTime(180_000) })
    expect(api.obtenerResumenBarbero).toHaveBeenCalledTimes(2)

    visibilidad.mockReturnValue('visible')
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(api.obtenerResumenBarbero).toHaveBeenCalledTimes(3)
  }, ESPERA_TEST)

  it('al volver a la pestaña se refresca y una cita que venció con el panel abierto activa el aviso', async () => {
    montar()
    await esperarPanel()
    await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })
    expect(screen.queryByText(/No has confirmado/)).toBeNull()

    conPorConfirmar([vencida(1)])
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(await screen.findByText('No has confirmado 1 cita')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('cancela las peticiones en vuelo al desmontar', async () => {
    let senal
    vi.mocked(api.obtenerResumenBarbero).mockImplementation((_t, signal) => {
      senal = signal
      return new Promise(() => {})
    })
    const { unmount } = montar()
    await esperarPanel()
    await waitFor(() => expect(senal).toBeDefined())
    expect(senal.aborted).toBe(false)
    unmount()
    expect(senal.aborted).toBe(true)
  }, ESPERA_TEST)

  it('respuestas fuera de orden: la petición vieja que llega tarde no pisa a la nueva', async () => {
    const pendientes = []
    vi.mocked(api.obtenerResumenBarbero).mockImplementation(
      () => new Promise((resolver) => pendientes.push(resolver))
    )
    montar()
    await esperarPanel()
    await waitFor(() => expect(pendientes).toHaveLength(1))

    act(() => { document.dispatchEvent(new Event('visibilitychange')) }) // segunda petición
    await waitFor(() => expect(pendientes).toHaveLength(2))

    pendientes[1]({ ...RESUMEN, citas_hoy: 9, completadas_hoy: 0 }) // la nueva llega primero
    const cifras = await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })
    expect(within(cifras).getByText('Citas hoy').parentElement).toHaveTextContent('9')

    await act(async () => { pendientes[0]({ ...RESUMEN, citas_hoy: 1 }) }) // la vieja llega tarde
    expect(within(screen.getByRole('region', { name: 'Cifras de hoy y del mes' })).getByText('Citas hoy').parentElement).toHaveTextContent('9')
  }, ESPERA_TEST)

  it('si un refresco falla se conservan los datos anteriores en pantalla', async () => {
    montar()
    await esperarPanel()
    await screen.findByRole('region', { name: 'Cifras de hoy y del mes' })
    vi.mocked(api.obtenerResumenBarbero).mockRejectedValue(new Error('sin red'))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(api.obtenerResumenBarbero).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('region', { name: 'Cifras de hoy y del mes' })).toBeInTheDocument()
    expect(screen.queryByText('No pudimos cargar tu resumen.')).toBeNull()
  }, ESPERA_TEST)
})

describe('Confirmación al cerrar sesión (barbero)', () => {
  const dialogo = () => screen.getByRole('dialog', { name: '¿Cerrar sesión?' })
  const abrirDesdeMenu = async () => {
    const disparador = await screen.findByRole('button', { name: /Menú de usuario/ })
    await userEvent.click(disparador)
    await userEvent.click(within(document.getElementById('menu-usuario')).getByRole('button', { name: 'Cerrar sesión' }))
    return disparador
  }

  it('el menú de usuario abre el diálogo (título, mensaje, foco en Cancelar) sin cerrar la sesión', async () => {
    sinBienvenida()
    montar()
    await esperarPanel()
    await abrirDesdeMenu()

    expect(dialogo()).toHaveAttribute('aria-modal', 'true')
    expect(within(dialogo()).getByText('Tendrás que volver a iniciar sesión para entrar al panel.')).toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(localStorage.getItem('token')).not.toBeNull()
    expect(ruta()).toBe('/panel')
  })

  it('Cancelar y Escape cierran el diálogo, mantienen la sesión y devuelven el foco al botón del menú', async () => {
    sinBienvenida()
    montar()
    await esperarPanel()
    let disparador = await abrirDesdeMenu()
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(disparador).toHaveFocus()

    disparador = await abrirDesdeMenu()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(disparador).toHaveFocus()
    expect(localStorage.getItem('token')).not.toBeNull()
  })

  it('el clic fuera del diálogo lo cancela', async () => {
    sinBienvenida()
    montar()
    await esperarPanel()
    await abrirDesdeMenu()
    await userEvent.pointer({ keys: '[MouseLeft]', target: dialogo().parentElement })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem('token')).not.toBeNull()
  })

  it('queda por encima del aviso persistente de por confirmar (z-50 frente a z-20)', async () => {
    sinBienvenida()
    conPorConfirmar([vencida(1)])
    montar()
    await esperarPanel()
    await screen.findByText(/No has confirmado 1 cita/, {}, { timeout: ESPERA })
    await abrirDesdeMenu()
    expect(dialogo().parentElement).toHaveClass('z-50')
    expect(screen.getByText(/No has confirmado 1 cita/).closest('.z-20')).not.toBeNull()
  })

  it('en el cajón móvil: abre por encima, Cancelar devuelve el foco al botón del cajón y confirmar cierra la sesión', async () => {
    sinBienvenida()
    fijarEscritorio(false)
    montar()
    await esperarPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const botonCajon = within(screen.getByRole('dialog', { name: 'Menú de navegación' })).getByRole('button', { name: 'Cerrar sesión' })
    await userEvent.click(botonCajon)

    expect(dialogo()).toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await userEvent.tab()
    expect(dialogo().contains(document.activeElement)).toBe(true) // el cajón no le roba el foco

    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: '¿Cerrar sesión?' })).toBeNull()
    expect(botonCajon).toHaveFocus()
    expect(localStorage.getItem('token')).not.toBeNull()

    await userEvent.click(botonCajon)
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(ruta()).toBe('/acceso'))
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('Escape en el cajón móvil cierra solo el diálogo de confirmación, no el cajón', async () => {
    sinBienvenida()
    fijarEscritorio(false)
    montar()
    await esperarPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Menú de navegación' })).getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '¿Cerrar sesión?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Menú de navegación' })).toBeInTheDocument()
  })

  it('un token vencido NO muestra el diálogo: va al acceso con "Tu sesión expiró"', async () => {
    const vencido = { id: 1, usuario: 'leo', rol: 'barbero', barbero_id: 2, exp: Math.floor(Date.now() / 1000) - 60 }
    localStorage.setItem('token', `x.${btoa(JSON.stringify(vencido))}.y`)
    montar()
    await waitFor(() => expect(ruta()).toBe('/acceso'))
    expect(screen.queryByRole('dialog', { name: '¿Cerrar sesión?' })).toBeNull()
    expect(await screen.findByText(/Tu sesión expiró/, {}, { timeout: ESPERA })).toBeInTheDocument()
  })
})
