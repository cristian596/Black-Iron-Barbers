import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import * as api from '../services/api'
import { hoyISO } from '../utils/fechas'

vi.mock('../services/api')

const ESPERA = 10_000
const ESPERA_TEST = 20_000
const VIGENTE = { estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' }

const sesion = () => {
  const payload = { id: 1, usuario: 'leo', rol: 'barbero', barbero_id: 2, exp: Math.floor(Date.now() / 1000) + 3600 }
  localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
}
const fijarAncho = (esEscritorio) => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: esEscritorio, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

const RESUMEN = {
  fecha: hoyISO(), citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null,
  ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 0,
}
const CONTEOS = { hoy: 3, proximas: 5, por_confirmar: 4, completadas: 20, canceladas: 2, todas: 40 }

const cita = (id, extra = {}) => ({
  id, cliente: `Cliente ${id}`, servicio_nombre: 'Corte clásico', duracion_min: 30, fecha: '2026-09-28', hora: '10:00:00',
  estado: 'pendiente', precio: 40000, por_confirmar: false, ...extra,
})

// "Servidor": respuesta que devuelven los mocks (cada prueba la ajusta).
let servidor
const reiniciar = () => {
  servidor = {
    total: 40,
    conteos: { ...CONTEOS },
    porConfirmar: 4,
    items: (filtros) => {
      const desde = (filtros.pagina - 1) * filtros.limite
      const cuantas = Math.max(0, Math.min(filtros.limite, servidor.total - desde))
      return Array.from({ length: cuantas }, (_, i) => cita(desde + i + 1))
    },
  }
}

let router
const montar = (ruta = '/panel/citas') => {
  router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
const params = () => new URLSearchParams(router.state.location.search)
const ultima = () => vi.mocked(api.obtenerMisCitas).mock.calls.at(-1)[1]
const esperarLista = () => screen.findByRole('region', { name: 'Lista de citas' }, { timeout: ESPERA })
const esperarDatos = async () => {
  await esperarLista()
  await screen.findByText(/Mostrando/, {}, { timeout: ESPERA })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.setItem('bienvenida-barbero-vista', '1')
  sesion()
  fijarAncho(false)
  reiniciar()
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 2, nombre: 'Leo', cargo: 'Barbero', foto: null }])
  vi.mocked(api.obtenerSesion).mockResolvedValue({ usuario: {}, vigencia: VIGENTE })
  vi.mocked(api.obtenerResumenBarbero).mockImplementation(async () => ({ ...RESUMEN, por_confirmar: servidor.porConfirmar }))
  vi.mocked(api.obtenerCitasPorConfirmar).mockResolvedValue({ total: 0, tope: 100, items: [] })
  vi.mocked(api.obtenerAgendaHoy).mockResolvedValue({ fecha: hoyISO(), citas: [] })
  vi.mocked(api.obtenerMisCitas).mockImplementation(async (_t, filtros) => ({
    items: servidor.items(filtros), pagina: filtros.pagina, limite: filtros.limite, total: servidor.total, conteos: servidor.conteos,
  }))
  vi.mocked(api.actualizarCita).mockResolvedValue({})
})

afterEach(() => {
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('/panel/citas: estado en la URL', () => {
  it('por defecto pide la pestaña "hoy", página 1, 15 por página, y no escribe nada en la URL', async () => {
    montar()
    await esperarDatos()
    expect(api.obtenerMisCitas).toHaveBeenCalledWith(expect.any(String), { pestana: 'hoy', q: '', desde: '', hasta: '', pagina: 1, limite: 15 })
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('heading', { level: 1, name: 'Mis citas' })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('lee pestaña, búsqueda, fechas y página de la URL', async () => {
    montar('/panel/citas?pestana=por_confirmar&q=ana&desde=2026-10-01&hasta=2026-10-03&pagina=2')
    await esperarDatos()
    expect(ultima()).toEqual({ pestana: 'por_confirmar', q: 'ana', desde: '2026-10-01', hasta: '2026-10-03', pagina: 2, limite: 15 })
    expect(screen.getByLabelText('Buscar')).toHaveValue('ana')
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-10-03')
    expect(screen.getByText('Mostrando 16–30 de 40')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('un valor inválido en la URL se ignora (pestaña, página, fechas, barbero)', async () => {
    montar('/panel/citas?pestana=x&pagina=0&desde=2026-02-31&hasta=hoy&barbero=2')
    await esperarDatos()
    expect(ultima()).toEqual({ pestana: 'hoy', q: '', desde: '', hasta: '', pagina: 1, limite: 15 })
  }, ESPERA_TEST)

  it('cambiar de pestaña actualiza la URL y vuelve a la página 1; la de por defecto no se escribe', async () => {
    montar('/panel/citas?pagina=2')
    await esperarDatos()
    await userEvent.click(screen.getByRole('button', { name: /^Próximas/ }))
    await waitFor(() => expect(params().get('pestana')).toBe('proximas'))
    expect(params().has('pagina')).toBe(false)
    expect(ultima().pestana).toBe('proximas')

    await userEvent.click(screen.getByRole('button', { name: /^Hoy/ }))
    await waitFor(() => expect(params().has('pestana')).toBe(false))
  }, ESPERA_TEST)

  it('la búsqueda se aplica al dejar de escribir, reinicia la página y se puede limpiar', async () => {
    montar('/panel/citas?pagina=2')
    await esperarDatos()
    await userEvent.type(screen.getByLabelText('Buscar'), 'ana')
    await waitFor(() => expect(params().get('q')).toBe('ana'), { timeout: 8000 })
    expect(params().has('pagina')).toBe(false)
    await waitFor(() => expect(ultima().q).toBe('ana'), { timeout: 8000 })

    await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    await waitFor(() => expect(params().has('q')).toBe(false), { timeout: 8000 })
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
  }, ESPERA_TEST)

  it('el rango de fechas va a la URL y reinicia la página; no hay filtro de barbero', async () => {
    montar('/panel/citas?pagina=2')
    await esperarDatos()
    expect(screen.queryByLabelText('Barbero')).toBeNull()
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-01')
    await waitFor(() => expect(params().get('desde')).toBe('2026-10-01'))
    expect(params().has('pagina')).toBe(false)
    expect(ultima().desde).toBe('2026-10-01')
  }, ESPERA_TEST)
})

describe('/panel/citas: pestañas con conteo', () => {
  it('muestra el conteo de cada pestaña, marca la activa con aria-pressed y destaca "Por confirmar" si es > 0', async () => {
    montar('/panel/citas?pestana=proximas')
    await esperarDatos()
    const grupo = screen.getByRole('group', { name: 'Filtrar citas' })
    const botones = within(grupo).getAllByRole('button')

    expect(botones.map((b) => b.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Hoy: 3', 'Próximas: 5', 'Por confirmar: 4', 'Completadas: 20', 'Canceladas: 2', 'Todas: 40',
    ])
    expect(within(grupo).getByRole('button', { name: /^Próximas/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo).getByRole('button', { name: /^Hoy/ })).toHaveAttribute('aria-pressed', 'false')
    expect(within(grupo).getByRole('button', { name: /^Por confirmar/ }).querySelector('span')).toHaveClass('bg-orange-500')
    expect(within(grupo).getByRole('button', { name: /^Completadas/ }).querySelector('span')).not.toHaveClass('bg-orange-500')
  }, ESPERA_TEST)

  it('con 0 por confirmar la insignia no se destaca', async () => {
    servidor.conteos = { ...CONTEOS, por_confirmar: 0 }
    montar()
    await esperarDatos()
    expect(screen.getByRole('button', { name: /^Por confirmar/ }).querySelector('span')).not.toHaveClass('bg-orange-500')
  }, ESPERA_TEST)

  it('se manejan con el teclado: Tab llega a cada pestaña y Enter la activa', async () => {
    montar()
    await esperarDatos()
    const proximas = screen.getByRole('button', { name: /^Próximas/ })
    proximas.focus()
    expect(proximas).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(params().get('pestana')).toBe('proximas'))
  }, ESPERA_TEST)
})

describe('/panel/citas: lista, tabla y tarjetas', () => {
  beforeEach(() => {
    servidor.total = 3
    servidor.items = () => [
      cita(1, { hora: '09:00:00', estado: 'completada', fecha: '2026-10-04' }),
      cita(2, { hora: '10:00:00', por_confirmar: true }),
      cita(3, { hora: '11:00:00', precio: 0, estado: 'cancelada' }),
    ]
  })

  it('≥ 1280 px: tabla real con encabezados, fila por cita y acciones solo en las pendientes', async () => {
    fijarAncho(true)
    montar()
    const tabla = await screen.findByRole('table', { name: 'Mis citas' }, { timeout: ESPERA })

    expect(within(tabla).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha', 'Hora', 'Cliente', 'Servicio', 'Duración', 'Precio', 'Estado', 'Acciones',
    ])
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveTextContent('04/10/2026')
    expect(filas[0]).toHaveTextContent('09:00')
    expect(filas[0]).toHaveTextContent('Cliente 1')
    expect(filas[0]).toHaveTextContent('Corte clásico')
    expect(filas[0]).toHaveTextContent('30 min')
    expect(filas[0]).toHaveTextContent('$40.000')
    expect(filas[0]).toHaveTextContent('Completada')
    expect(within(filas[0]).queryByRole('button')).toBeNull()
    expect(filas[1]).toHaveTextContent('Pendiente')
    expect(filas[1]).toHaveTextContent('Por confirmar')
    expect(within(filas[1]).getByRole('button', { name: 'Completar la cita de Cliente 2' })).toBeInTheDocument()
    expect(within(filas[1]).getByRole('button', { name: 'Cancelar la cita de Cliente 2' })).toBeInTheDocument()
    expect(filas[2]).toHaveTextContent('Gratis')
    expect(filas[2]).toHaveTextContent('Cancelada')
    expect(within(filas[2]).queryByRole('button')).toBeNull()
  }, ESPERA_TEST)

  it('< 1280 px: tarjetas (sin tabla) con la misma información', async () => {
    fijarAncho(false)
    montar()
    // La región "Lista de citas" existe desde el primer render (con el esqueleto dentro): hay que esperar los datos.
    await esperarDatos()
    const region = await esperarLista()
    const lista = within(region).getByRole('list')
    expect(screen.queryByRole('table')).toBeNull()
    const tarjetas = within(lista).getAllByRole('listitem')
    expect(tarjetas).toHaveLength(3)
    expect(tarjetas[1]).toHaveTextContent('Cliente 2')
    expect(tarjetas[1]).toHaveTextContent('28/09/2026 · 10:00')
    expect(tarjetas[1]).toHaveTextContent('Corte clásico · 30 min · $40.000')
    expect(tarjetas[1]).toHaveTextContent('Por confirmar')
    expect(within(tarjetas[1]).getByRole('button', { name: 'Completar la cita de Cliente 2' })).toBeInTheDocument()
    expect(within(tarjetas[0]).queryByRole('button')).toBeNull()
  }, ESPERA_TEST)
})

describe('/panel/citas: paginación', () => {
  it('15 por página: Siguiente y los números cambian la página en la URL y pasan el filtro', async () => {
    montar('/panel/citas?pestana=todas&q=ana')
    await esperarDatos()
    expect(screen.getByText('Mostrando 1–15 de 40')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Paginación' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(params().get('pagina')).toBe('2'))
    expect(ultima()).toMatchObject({ pestana: 'todas', q: 'ana', pagina: 2 })
    expect(await screen.findByText('Mostrando 16–30 de 40')).toBeInTheDocument()
    await userEvent.click(within(nav).getByRole('button', { name: 'Página 3' }))
    await waitFor(() => expect(params().get('pagina')).toBe('3'))
  }, ESPERA_TEST)

  it('una página inexistente lleva a la última válida', async () => {
    montar('/panel/citas?pagina=9')
    await waitFor(() => expect(params().get('pagina')).toBe('3'), { timeout: ESPERA })
    expect(await screen.findByText('Mostrando 31–40 de 40')).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('/panel/citas: completar y cancelar', () => {
  beforeEach(() => {
    servidor.total = 2
    servidor.items = () => [cita(1, { por_confirmar: true }), cita(2)]
  })

  it('completar recarga la lista con la misma página y filtros y refresca el aviso persistente al instante', async () => {
    montar('/panel/citas?pestana=por_confirmar&q=ana')
    expect(await screen.findByText('No has confirmado 4 citas', {}, { timeout: ESPERA })).toBeInTheDocument()
    await esperarDatos()
    const antesLista = vi.mocked(api.obtenerMisCitas).mock.calls.length
    const antesResumen = vi.mocked(api.obtenerResumenBarbero).mock.calls.length

    servidor.porConfirmar = 3
    await userEvent.click(screen.getByRole('button', { name: 'Completar la cita de Cliente 1' }))

    expect(api.actualizarCita).toHaveBeenCalledWith(expect.any(String), 1, { estado: 'completada' })
    await waitFor(() => expect(vi.mocked(api.obtenerResumenBarbero).mock.calls.length).toBe(antesResumen + 1))
    await waitFor(() => expect(vi.mocked(api.obtenerMisCitas).mock.calls.length).toBe(antesLista + 1))
    expect(ultima()).toMatchObject({ pestana: 'por_confirmar', q: 'ana', pagina: 1 })
    expect(await screen.findByText('No has confirmado 3 citas')).toBeInTheDocument()
    expect(params().get('q')).toBe('ana')
  }, ESPERA_TEST)

  it('cuando se confirma la última, el aviso persistente desaparece', async () => {
    servidor.porConfirmar = 1
    montar('/panel/citas?pestana=por_confirmar')
    expect(await screen.findByText('No has confirmado 1 cita', {}, { timeout: ESPERA })).toBeInTheDocument()
    await esperarDatos()
    servidor.porConfirmar = 0
    await userEvent.click(screen.getByRole('button', { name: 'Completar la cita de Cliente 1' }))
    await waitFor(() => expect(screen.queryByText(/No has confirmado/)).toBeNull())
  }, ESPERA_TEST)

  it('cancelar pide confirmación con ModalConfirmar (no window.confirm) y solo cancela al confirmar', async () => {
    const confirmar = vi.spyOn(window, 'confirm')
    montar()
    await esperarDatos()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la cita de Cliente 1' }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toHaveTextContent('¿Seguro que quieres cancelar la cita de Cliente 1')
    expect(api.actualizarCita).not.toHaveBeenCalled()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(api.actualizarCita).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la cita de Cliente 1' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }))
    expect(api.actualizarCita).toHaveBeenCalledWith(expect.any(String), 1, { estado: 'cancelada' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(confirmar).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it('si el back-end rechaza completar (CITA_FUTURA) el mensaje se ve en pantalla y no se recarga', async () => {
    vi.mocked(api.actualizarCita).mockRejectedValue(Object.assign(new Error('No se puede completar una cita de una fecha futura'), { codigo: 'CITA_FUTURA' }))
    montar()
    await esperarDatos()
    const antes = vi.mocked(api.obtenerMisCitas).mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'Completar la cita de Cliente 2' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede completar una cita de una fecha futura')
    expect(vi.mocked(api.obtenerMisCitas).mock.calls.length).toBe(antes)
  }, ESPERA_TEST)

  it('si cancelar falla, el error sale dentro del diálogo', async () => {
    vi.mocked(api.actualizarCita).mockRejectedValueOnce(new Error('Cita no encontrada'))
    montar()
    await esperarDatos()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la cita de Cliente 2' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar cita' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Cita no encontrada')
  }, ESPERA_TEST)
})

describe('/panel/citas: estados', () => {
  it('mientras carga muestra esqueletos con aviso de estado', async () => {
    vi.mocked(api.obtenerMisCitas).mockReturnValue(new Promise(() => {}))
    montar()
    expect(await screen.findByText('Cargando tus citas...', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('error: ErrorCarga con "Reintentar" que vuelve a pedir la misma página', async () => {
    vi.mocked(api.obtenerMisCitas).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    montar('/panel/citas?pagina=2')
    const alerta = (await screen.findByText('No pudimos cargar tus citas.', {}, { timeout: ESPERA })).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Mostrando 16–30 de 40')).toBeInTheDocument()
    expect(ultima().pagina).toBe(2)
  }, ESPERA_TEST)

  it.each([
    ['hoy', 'Hoy no tienes citas agendadas.'],
    ['proximas', 'No tienes citas próximas.'],
    ['por_confirmar', 'No tienes citas por confirmar. Todo está al día.'],
    ['completadas', 'Aún no tienes citas completadas.'],
    ['canceladas', 'No tienes citas canceladas.'],
    ['todas', 'Todavía no tienes citas registradas.'],
  ])('vacío en la pestaña %s: mensaje propio y sin botón de limpiar', async (pestana, mensaje) => {
    servidor.total = 0
    montar(`/panel/citas?pestana=${pestana}`)
    expect(await screen.findByText(mensaje, {}, { timeout: ESPERA })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Lista de citas' })).queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  }, ESPERA_TEST)

  it('vacío con filtros activos: "No hay citas que coincidan" con "Limpiar filtros" que los quita', async () => {
    servidor.total = 0
    montar('/panel/citas?q=zzz')
    expect(await screen.findByText('No hay citas que coincidan con los filtros.', {}, { timeout: ESPERA })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('region', { name: 'Lista de citas' })).getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(params().has('q')).toBe(false))
  }, ESPERA_TEST)
})
