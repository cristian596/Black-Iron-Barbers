import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import * as api from '../services/api'
import { marcarBienvenidaMostrada } from '../utils/bienvenida'
import { fechaRelativa, hoyISO } from '../utils/fechas'
import { textoCambiosPerfil } from '../utils/perfil'

vi.mock('../services/api')

// Las páginas se cargan con React.lazy: margen de espera para la suite completa.
const ESPERA = 10_000
const ESPERA_TEST = 20_000

const UUID = '3f2b8c1e-5a4d-4c3b-9e7f-1a2b3c4d5e6f'
const hace = (ms) => new Date(Date.now() - ms).toISOString()

const sesion = (rol) => {
  const payload = { id: 1, usuario: rol === 'admin' ? 'admin_acceso' : 'leo_acceso', rol, barbero_id: rol === 'barbero' ? 2 : null, exp: Math.floor(Date.now() / 1000) + 3600 }
  localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
}

const fijarEscritorio = () => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

// Cambios que el "servidor" devuelve; cada prueba los modifica.
let servidor
const cambioNombre = (id, anterior, nuevo, extra = {}) => ({ id, usuario: 'barbero_x', campo: 'nombre', valor_anterior: anterior, valor_nuevo: nuevo, creado_en: hace(5 * 60_000), ...extra })
const cambioFoto = (id, extra = {}) => ({ id, usuario: 'barbero_x', campo: 'foto', valor_anterior: '/Barberos/leo.jpg', valor_nuevo: `${UUID}.png`, creado_en: hace(2 * 3_600_000), ...extra })
const barbero = (id, nombre, cambios, extra = {}) => ({
  barbero_id: id, nombre, nombre_perfil: null, foto_url: '/Barberos/leo.jpg', foto_propia: false, ultimo_cambio: cambios[0].creado_en, cambios, ...extra,
})
const fijarCambios = (barberos) => {
  servidor = { total_barberos: barberos.length, barberos }
}
const LEO = () => barbero(2, 'Leo', [cambioFoto(12), cambioNombre(11, 'Leo', 'Leo El Barbero')], { nombre_perfil: 'Leo El Barbero', foto_url: `/api/perfil/foto/${UUID}.png`, foto_propia: true })
const ANA = () => barbero(3, 'Ana Ríos', [cambioNombre(21, 'Ana Ríos', 'Anita')], { nombre_perfil: 'Anita', foto_url: null })

let router
const montar = (ruta = '/admin') => {
  router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
const esperarLayout = () => screen.findByRole('navigation', { name: 'Secciones del panel' }, { timeout: ESPERA })
const titulo = () => screen.findByRole('heading', { level: 2, name: 'Cambios de perfil de barberos' }, { timeout: ESPERA })
const seccion = async () => within((await titulo()).closest('section'))
const aviso = () => screen.queryByText(/han? cambiado su foto o nombre de perfil/)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  marcarBienvenidaMostrada()
  sesion('admin')
  fijarEscritorio()
  fijarCambios([])
  vi.mocked(api.obtenerCambiosPerfil).mockImplementation(async () => structuredClone(servidor))
  vi.mocked(api.obtenerPerfil).mockResolvedValue({
    usuario: 'admin_acceso', rol: 'admin', nombre: 'admin_acceso', foto_url: null, foto_propia: false,
    nombre_perfil: null, usa_nombre_publico: true, usa_foto_publica: true,
  })
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 2, nombre: 'Leo', cargo: 'Barbero Senior', especialidad: 'Fade', foto: null }])
  vi.mocked(api.obtenerEmpleados).mockResolvedValue([])
  vi.mocked(api.obtenerReporteDiario).mockResolvedValue({
    fecha: hoyISO(), total_cortes: 0, ingresos: 0, ticket_promedio: 0, canceladas: 0, pendientes_sin_cerrar: 0, servicios_mas_pedidos: [],
  })
  const periodo = { clave: 'hoy', desde: hoyISO(), hasta: hoyISO() }
  const ceros = { citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 }
  vi.mocked(api.obtenerEstadisticas).mockResolvedValue({ periodo, anterior: { desde: periodo.desde, hasta: periodo.hasta }, actual: ceros, previo: ceros })
  vi.mocked(api.obtenerIngresos).mockResolvedValue({ agrupar: 'dia', puntos: [], anteriores: [] })
  vi.mocked(api.obtenerServiciosTop).mockResolvedValue({ periodo, servicios: [] })
  vi.mocked(api.obtenerCitasAdmin).mockResolvedValue({ items: [], total: 0, pagina: 1, limite: 10 })
  vi.mocked(api.obtenerServiciosAdmin).mockResolvedValue([])
  vi.mocked(api.obtenerCategoriasAdmin).mockResolvedValue([])
  // Acciones: el "servidor" quita al barbero revisado o restablecido.
  const quitar = async (_token, id) => {
    servidor = { total_barberos: servidor.barberos.length - 1, barberos: servidor.barberos.filter((b) => b.barbero_id !== id) }
    return {}
  }
  vi.mocked(api.revisarCambiosPerfil).mockImplementation(quitar)
  vi.mocked(api.restablecerPerfilBarbero).mockImplementation(quitar)
})

afterEach(() => {
  delete window.matchMedia
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('utils: textoCambiosPerfil y fechaRelativa', () => {
  it('singular y plural', () => {
    expect(textoCambiosPerfil(1)).toBe('1 barbero ha cambiado su foto o nombre de perfil')
    expect(textoCambiosPerfil(2)).toBe('2 barberos han cambiado su foto o nombre de perfil')
    expect(textoCambiosPerfil(11)).toBe('11 barberos han cambiado su foto o nombre de perfil')
  })

  it('fechaRelativa: en hora de Bogotá, con "hace…", "hoy", "ayer" y fecha corta', () => {
    const ahora = new Date('2026-10-06T20:00:00Z') // 15:00 en Bogotá
    expect(fechaRelativa('2026-10-06T19:59:40Z', ahora)).toBe('hace un momento')
    expect(fechaRelativa('2026-10-06T19:55:00Z', ahora)).toBe('hace 5 min')
    expect(fechaRelativa('2026-10-06T15:30:00Z', ahora)).toMatch(/^hoy, 10:30\s?a\. ?m\.$/) // 10:30 Bogotá
    expect(fechaRelativa('2026-10-05T20:00:00Z', ahora)).toMatch(/^ayer, 3:00\s?p\. ?m\.$/)
    expect(fechaRelativa('2026-10-01T20:00:00Z', ahora)).toMatch(/^1 de oct,? 3:00\s?p\. ?m\.$/)
    // En UTC ya es el día siguiente, pero en Bogotá todavía es el mismo día: cuenta como "hoy"
    expect(fechaRelativa('2026-10-07T03:30:00Z', new Date('2026-10-07T04:50:00Z'))).toMatch(/^hoy, 10:30\s?p\. ?m\.$/)
    // y al pasar la medianoche de Bogotá (05:00 UTC) esa misma hora pasa a "ayer"
    expect(fechaRelativa('2026-10-07T03:30:00Z', new Date('2026-10-07T12:00:00Z'))).toMatch(/^ayer, 10:30\s?p\. ?m\.$/)
    expect(fechaRelativa('no es una fecha', ahora)).toBe('')
  })
})

describe('Aviso persistente del admin', () => {
  it('con 0 pendientes no se muestra', async () => {
    montar('/admin')
    await esperarLayout()
    await waitFor(() => expect(api.obtenerCambiosPerfil).toHaveBeenCalled())
    await act(async () => {})
    expect(aviso()).toBeNull()
  }, ESPERA_TEST)

  it('singular y plural, con enlace a la sección de revisión y sin botón de cerrar', async () => {
    fijarCambios([LEO()])
    montar('/admin')
    const texto = await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })
    const region = texto.closest('[role="status"]')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    const caja = texto.closest('.fixed')
    expect(within(caja).getByRole('link', { name: 'Revisar ahora' })).toHaveAttribute('href', '/admin/configuracion#cambios-perfil')
    expect(within(caja).queryByRole('button')).toBeNull() // no se puede cerrar
    expect(caja).toHaveClass('z-20', 'bottom-0', 'inset-x-0', 'lg:right-6') // franja inferior en móvil, tarjeta a la derecha en escritorio
    expect(caja).toHaveClass('print:hidden')
  }, ESPERA_TEST)

  it('plural con dos barberos', async () => {
    fijarCambios([LEO(), ANA()])
    montar('/admin')
    expect(await screen.findByText('2 barberos han cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)

  it.each(['/admin', '/admin/citas', '/admin/servicios', '/admin/empleados', '/admin/reportes', '/admin/configuracion'])(
    'aparece en %s',
    async (ruta) => {
      fijarCambios([LEO()])
      montar(ruta)
      expect(await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })).toBeInTheDocument()
    },
    ESPERA_TEST
  )

  it('el enlace lleva a /admin/configuracion con el ancla y el foco va al título de la vista', async () => {
    fijarCambios([LEO()])
    montar('/admin/citas')
    await userEvent.click(await screen.findByRole('link', { name: 'Revisar ahora' }, { timeout: ESPERA }))
    const encabezado = await titulo()
    expect(router.state.location.pathname + router.state.location.hash).toBe('/admin/configuracion#cambios-perfil')
    await waitFor(() => expect(encabezado).toHaveFocus())
  }, ESPERA_TEST)

  it('el texto solo cambia cuando cambia el número (no se re-anuncia en cada refresco)', async () => {
    fijarCambios([LEO(), ANA()])
    montar('/admin')
    const texto = await screen.findByText('2 barberos han cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })
    const nodo = texto.firstChild
    const observador = vi.fn()
    new MutationObserver(observador).observe(texto.closest('[role="status"]'), { childList: true, subtree: true, characterData: true })

    // refresco con el mismo conteo
    const antes = vi.mocked(api.obtenerCambiosPerfil).mock.calls.length
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(vi.mocked(api.obtenerCambiosPerfil).mock.calls.length).toBe(antes + 1))
    await act(async () => {})
    expect(observador).not.toHaveBeenCalled()
    expect(screen.getByText('2 barberos han cambiado su foto o nombre de perfil').firstChild).toBe(nodo)

    // y cuando cambia el número, el texto cambia
    fijarCambios([LEO()])
    document.dispatchEvent(new Event('visibilitychange'))
    expect(await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil')).toBeInTheDocument()
    expect(observador).toHaveBeenCalled()
  }, ESPERA_TEST)

  it('se actualiza solo cada 60 s (polling) y desaparece cuando llega a 0', async () => {
    // Se captura el temporizador de 60 s del proveedor para dispararlo a mano (sin tocar los temporizadores de las pruebas).
    const intervalos = []
    const original = window.setInterval
    vi.spyOn(window, 'setInterval').mockImplementation((fn, ms, ...resto) => {
      if (ms === 60_000) {
        intervalos.push(fn)
        return 0
      }
      return original(fn, ms, ...resto)
    })
    fijarCambios([LEO()])
    montar('/admin')
    await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })
    expect(intervalos).toHaveLength(1)
    const antes = vi.mocked(api.obtenerCambiosPerfil).mock.calls.length

    fijarCambios([])
    await act(async () => intervalos[0]())
    expect(vi.mocked(api.obtenerCambiosPerfil).mock.calls.length).toBe(antes + 1)
    await waitFor(() => expect(aviso()).toBeNull())
  }, ESPERA_TEST)

  it('una respuesta vieja no pisa a una nueva (protección contra respuestas obsoletas) y cada ciclo cancela al anterior', async () => {
    let resolverLenta
    const senales = []
    vi.mocked(api.obtenerCambiosPerfil)
      .mockImplementationOnce((_token, senal) => {
        senales.push(senal)
        return new Promise((r) => (resolverLenta = r))
      })
      .mockImplementation(async (_token, senal) => {
        senales.push(senal)
        return { total_barberos: 2, barberos: [LEO(), ANA()] }
      })
    montar('/admin')
    await esperarLayout()
    await waitFor(() => expect(senales).toHaveLength(1))

    document.dispatchEvent(new Event('visibilitychange')) // segundo ciclo (rápido)
    expect(await screen.findByText('2 barberos han cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })).toBeInTheDocument()
    expect(senales[0].aborted).toBe(true)

    await act(async () => resolverLenta({ total_barberos: 1, barberos: [LEO()] })) // llega tarde
    expect(screen.getByText('2 barberos han cambiado su foto o nombre de perfil')).toBeInTheDocument()
    expect(screen.queryByText('1 barbero ha cambiado su foto o nombre de perfil')).toBeNull()
  }, ESPERA_TEST)

  it('si un refresco falla se conserva el aviso con los datos anteriores', async () => {
    fijarCambios([LEO()])
    montar('/admin')
    await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })
    vi.mocked(api.obtenerCambiosPerfil).mockRejectedValue(new Error('No se pudo conectar con el servidor'))
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(vi.mocked(api.obtenerCambiosPerfil).mock.calls.length).toBeGreaterThan(1))
    await act(async () => {})
    expect(screen.getByText('1 barbero ha cambiado su foto o nombre de perfil')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('el barbero NO ve el aviso ni la vista, y ni siquiera se piden los cambios', async () => {
    sesion('barbero')
    fijarCambios([LEO()])
    vi.mocked(api.obtenerSesion).mockResolvedValue({ usuario: {}, vigencia: { estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' } })
    vi.mocked(api.obtenerPerfil).mockResolvedValue({
      usuario: 'leo_acceso', rol: 'barbero', nombre: 'Leo', foto_url: null, foto_propia: false,
      nombre_perfil: null, usa_nombre_publico: true, usa_foto_publica: true,
    })
    vi.mocked(api.obtenerResumenBarbero).mockResolvedValue({
      fecha: hoyISO(), citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null, ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 0,
    })
    vi.mocked(api.obtenerCitasPorConfirmar).mockResolvedValue({ total: 0, tope: 100, items: [] })
    vi.mocked(api.obtenerAgendaHoy).mockResolvedValue({ fecha: hoyISO(), citas: [] })

    for (const ruta of ['/panel', '/panel/configuracion']) {
      const { unmount } = montar(ruta)
      await screen.findByRole('complementary', { name: 'Menú de navegación' }, { timeout: ESPERA })
      await act(async () => {})
      expect(aviso()).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Cambios de perfil de barberos' })).toBeNull()
      unmount()
    }
    expect(api.obtenerCambiosPerfil).not.toHaveBeenCalled()
  }, ESPERA_TEST)
})

describe('Vista de revisión en /admin/configuracion', () => {
  it('está debajo del formulario propio del admin y muestra una tarjeta por barbero con avatar, nombres y cambios', async () => {
    fijarCambios([LEO(), ANA()])
    montar('/admin/configuracion')
    const vista = await seccion()
    const formulario = screen.getByRole('heading', { level: 2, name: 'Nombre de perfil' })
    expect(formulario.compareDocumentPosition(await titulo()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const leo = vista.getByRole('article', { name: 'Cambios de perfil de Leo' })
    expect(within(leo).getByRole('heading', { level: 3, name: 'Leo' })).toBeInTheDocument() // nombre público
    expect(within(leo).getByText('Nombre de perfil actual: Leo El Barbero')).toBeInTheDocument()
    expect(within(leo).getByText('Cambió su foto')).toBeInTheDocument()
    expect(within(leo).getByText('Cambió su nombre de perfil:', { exact: false })).toBeInTheDocument()
    expect(within(leo).getByText('Leo', { selector: 'span.line-through' })).toBeInTheDocument()
    expect(within(leo).getByText('Leo El Barbero', { selector: 'strong' })).toBeInTheDocument()
    expect(within(leo).getByAltText(/foto de leo el barbero/i).getAttribute('src')).toMatch(new RegExp(`/api/perfil/foto/${UUID}\\.png$`))

    const ana = vista.getByRole('article', { name: 'Cambios de perfil de Ana Ríos' })
    expect(within(ana).getByText('Nombre de perfil actual: Anita')).toBeInTheDocument()
    expect(within(ana).getByRole('img', { name: 'Avatar de Anita' })).toBeInTheDocument() // sin foto: iniciales

    // fecha relativa en un <time> con la fecha completa en title
    const hora = within(leo).getAllByText(/^hace \d+ min$|^hoy, /)[0]
    expect(hora.tagName).toBe('TIME')
    expect(hora).toHaveAttribute('datetime')
    expect(hora.getAttribute('title')).toMatch(/\d{4}/)
  }, ESPERA_TEST)

  it('un barbero sin nombre de perfil dice que usa su nombre público', async () => {
    fijarCambios([barbero(2, 'Leo', [cambioFoto(1)])])
    montar('/admin/configuracion')
    const vista = await seccion()
    expect(vista.getByText('Usa su nombre público')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('sin pendientes muestra "Sin cambios pendientes"', async () => {
    montar('/admin/configuracion')
    const vista = await seccion()
    expect(await vista.findByText('Sin cambios pendientes')).toBeInTheDocument()
    expect(aviso()).toBeNull()
  }, ESPERA_TEST)

  it('estado de carga mientras llegan los datos', async () => {
    let resolver
    vi.mocked(api.obtenerCambiosPerfil).mockReturnValue(new Promise((r) => (resolver = r)))
    montar('/admin/configuracion')
    const vista = await seccion()
    expect(vista.getByText('Cargando cambios...')).toBeInTheDocument()
    expect(vista.queryByText('Sin cambios pendientes')).toBeNull()
    await act(async () => resolver({ total_barberos: 0, barberos: [] }))
    expect(await vista.findByText('Sin cambios pendientes')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('error de carga con Reintentar', async () => {
    vi.mocked(api.obtenerCambiosPerfil).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    montar('/admin/configuracion')
    const vista = await seccion()
    expect(await vista.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    fijarCambios([ANA()])
    await userEvent.click(vista.getByRole('button', { name: 'Reintentar' }))
    expect(await vista.findByRole('article', { name: 'Cambios de perfil de Ana Ríos' })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('"Marcar como revisado" quita la tarjeta y baja el aviso al instante, y deja el foco en el título', async () => {
    fijarCambios([LEO(), ANA()])
    montar('/admin/configuracion')
    const vista = await seccion()
    await screen.findByText('2 barberos han cambiado su foto o nombre de perfil', {}, { timeout: ESPERA })

    await userEvent.click(vista.getByRole('button', { name: 'Marcar como revisado el perfil de Leo' }))
    expect(api.revisarCambiosPerfil).toHaveBeenCalledWith(expect.any(String), 2)
    await waitFor(() => expect(vista.queryByRole('article', { name: 'Cambios de perfil de Leo' })).toBeNull())
    expect(vista.getByRole('article', { name: 'Cambios de perfil de Ana Ríos' })).toBeInTheDocument()
    expect(await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil')).toBeInTheDocument()
    expect(await titulo()).toHaveFocus()
    // y se vuelve a pedir el estado real al servidor
    await waitFor(() => expect(vi.mocked(api.obtenerCambiosPerfil).mock.calls.length).toBeGreaterThan(1))
  }, ESPERA_TEST)

  it('al revisar al último barbero el aviso desaparece y queda "Sin cambios pendientes"', async () => {
    fijarCambios([ANA()])
    montar('/admin/configuracion')
    const vista = await seccion()
    await userEvent.click(await vista.findByRole('button', { name: /Marcar como revisado/ }))
    expect(await vista.findByText('Sin cambios pendientes')).toBeInTheDocument()
    await waitFor(() => expect(aviso()).toBeNull())
  }, ESPERA_TEST)

  it('sin doble envío: mientras se guarda, todos los botones quedan deshabilitados y la petición va una vez', async () => {
    fijarCambios([LEO(), ANA()])
    let resolver
    vi.mocked(api.revisarCambiosPerfil).mockReturnValue(new Promise((r) => (resolver = r)))
    montar('/admin/configuracion')
    const vista = await seccion()
    const boton = await vista.findByRole('button', { name: 'Marcar como revisado el perfil de Leo' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    await waitFor(() => expect(boton).toHaveTextContent('Guardando...'))
    expect(boton).toBeDisabled()
    expect(vista.getByRole('button', { name: 'Restablecer el perfil de Leo' })).toBeDisabled()
    expect(vista.getByRole('button', { name: 'Marcar como revisado el perfil de Ana Ríos' })).toBeDisabled()
    expect(api.revisarCambiosPerfil).toHaveBeenCalledTimes(1)
    await act(async () => resolver({}))
  }, ESPERA_TEST)

  it('un error al marcar como revisado se muestra en la tarjeta y se puede reintentar', async () => {
    fijarCambios([LEO()])
    vi.mocked(api.revisarCambiosPerfil).mockRejectedValueOnce(new Error('Barbero no encontrado'))
    montar('/admin/configuracion')
    const vista = await seccion()
    const boton = await vista.findByRole('button', { name: /Marcar como revisado/ })
    await userEvent.click(boton)
    const tarjeta = vista.getByRole('article', { name: 'Cambios de perfil de Leo' })
    expect(await within(tarjeta).findByRole('alert')).toHaveTextContent('Barbero no encontrado')
    expect(boton).toBeEnabled()
    await userEvent.click(boton)
    await waitFor(() => expect(vista.queryByRole('article', { name: 'Cambios de perfil de Leo' })).toBeNull())
  }, ESPERA_TEST)

  it('"Restablecer perfil" pide confirmación con el foco en Cancelar y explica qué pasa; cancelar no hace nada', async () => {
    fijarCambios([LEO()])
    montar('/admin/configuracion')
    const vista = await seccion()
    await userEvent.click(await vista.findByRole('button', { name: 'Restablecer el perfil de Leo' }))

    const dialogo = await screen.findByRole('dialog', { name: '¿Restablecer el perfil de Leo?' })
    expect(within(dialogo).getByText(/volverá a ver en su panel su nombre y su foto públicos/i)).toBeInTheDocument()
    expect(within(dialogo).getByText(/se borrará la foto que subió/i)).toBeInTheDocument()
    expect(within(dialogo).getByText(/no afecta lo que ven los clientes en la web/i)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.restablecerPerfilBarbero).not.toHaveBeenCalled()
    expect(vista.getByRole('article', { name: 'Cambios de perfil de Leo' })).toBeInTheDocument()
    expect(screen.getByText('1 barbero ha cambiado su foto o nombre de perfil')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('confirmar restablece, cierra el diálogo y actualiza la lista y el aviso', async () => {
    fijarCambios([LEO(), ANA()])
    montar('/admin/configuracion')
    const vista = await seccion()
    await userEvent.click(await vista.findByRole('button', { name: 'Restablecer el perfil de Ana Ríos' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Restablecer el perfil de Ana Ríos?' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Restablecer perfil' }))

    expect(api.restablecerPerfilBarbero).toHaveBeenCalledWith(expect.any(String), 3)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(vista.queryByRole('article', { name: 'Cambios de perfil de Ana Ríos' })).toBeNull()
    expect(vista.getByRole('article', { name: 'Cambios de perfil de Leo' })).toBeInTheDocument()
    expect(await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('un error al restablecer se muestra dentro del diálogo, que sigue abierto, y la tarjeta se conserva', async () => {
    fijarCambios([LEO()])
    vi.mocked(api.restablecerPerfilBarbero).mockRejectedValueOnce(new Error('Barbero no encontrado'))
    montar('/admin/configuracion')
    const vista = await seccion()
    await userEvent.click(await vista.findByRole('button', { name: 'Restablecer el perfil de Leo' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Restablecer perfil' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Barbero no encontrado')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(vista.getByRole('article', { name: 'Cambios de perfil de Leo' })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('si el barbero cambia algo otra vez después de revisado, vuelve a aparecer (y el aviso con él)', async () => {
    fijarCambios([ANA()])
    montar('/admin/configuracion')
    const vista = await seccion()
    await userEvent.click(await vista.findByRole('button', { name: /Marcar como revisado/ }))
    expect(await vista.findByText('Sin cambios pendientes')).toBeInTheDocument()
    await waitFor(() => expect(aviso()).toBeNull())

    // el barbero cambia su foto de nuevo: el servidor lo devuelve con SOLO el cambio nuevo
    fijarCambios([barbero(3, 'Ana Ríos', [cambioFoto(30, { creado_en: hace(1000) })], { nombre_perfil: 'Anita', foto_url: `/api/perfil/foto/${UUID}.png`, foto_propia: true })])
    document.dispatchEvent(new Event('visibilitychange'))
    const tarjeta = await vista.findByRole('article', { name: 'Cambios de perfil de Ana Ríos' })
    expect(within(tarjeta).getByText('Cambió su foto')).toBeInTheDocument()
    expect(within(tarjeta).queryByText(/Cambió su nombre de perfil/)).toBeNull()
    expect(within(tarjeta).getByText('hace un momento')).toBeInTheDocument()
    expect(await screen.findByText('1 barbero ha cambiado su foto o nombre de perfil')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('el formulario propio del admin sigue funcionando junto a la vista', async () => {
    fijarCambios([LEO()])
    montar('/admin/configuracion')
    await titulo()
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Foto de perfil' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nombre de perfil' })).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('La web pública no depende del aviso ni de la revisión', () => {
  it('ni los componentes públicos ni las páginas públicas importan nada del admin, del perfil ni de los cambios', () => {
    const fuentes = {
      ...import.meta.glob('../components/sections/**/*.jsx', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../components/layout/**/*.jsx', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../pages/{Home,Cortes,ReservaCorte,NotFound,Landingpage}.jsx', { query: '?raw', import: 'default', eager: true }),
    }
    expect(Object.keys(fuentes).length).toBeGreaterThan(10)
    for (const [ruta, codigo] of Object.entries(fuentes)) {
      expect(codigo, ruta).not.toMatch(/CambiosPerfil|cambios-perfil|PerfilContext|components\/admin|obtenerPerfil|revisarCambios|restablecerPerfil/)
    }
  })

  it('el back-end de la web pública (/barberos) no cambia: api.js no pide los cambios desde ninguna función pública', async () => {
    const real = await vi.importActual('../services/api')
    const fetchSimulado = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    vi.stubGlobal('fetch', fetchSimulado)
    await real.obtenerBarberos()
    vi.unstubAllGlobals()
    expect(fetchSimulado.mock.calls).toHaveLength(1)
    expect(fetchSimulado.mock.calls[0][0]).toMatch(/\/barberos$/)
    expect(fetchSimulado.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })
})
