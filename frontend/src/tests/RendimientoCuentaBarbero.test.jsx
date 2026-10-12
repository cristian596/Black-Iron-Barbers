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

const VIGENTE = { estado: 'vigente', dias_restantes: 41, vence_en: '2026-11-14' }
const POR_VENCER = { estado: 'por_vencer', dias_restantes: 2, vence_en: '2026-10-07' }
const CADUCADA = { estado: 'caducada', dias_restantes: 0, vence_en: '2026-10-05' }

const sesion = (rol = 'barbero') => {
  const payload = { id: 1, usuario: rol === 'barbero' ? 'leo' : 'admin', rol, barbero_id: rol === 'barbero' ? 2 : null, exp: Math.floor(Date.now() / 1000) + 3600 }
  localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
}

const fijarEscritorio = () => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

const PERIODO = { clave: 'hoy', desde: '2026-10-04', hasta: '2026-10-04' }
const ANTERIOR = { desde: '2026-10-03', hasta: '2026-10-03' }
const CEROS = { citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 }
const estadisticas = (extra = {}) => ({
  periodo: PERIODO,
  anterior: ANTERIOR,
  actual: { citas: 6, completadas: 4, canceladas: 1, ingresos: 120000, ticket_promedio: 30000 },
  previo: { citas: 5, completadas: 5, canceladas: 0, ingresos: 150000, ticket_promedio: 30000 },
  ...extra,
})
const serieDia = (valor = () => 0) =>
  Array.from({ length: 30 }, (_, i) => ({ fecha: `2026-09-${String(i + 1).padStart(2, '0')}`, ingresos: valor(i), cortes: valor(i) > 0 ? 1 : 0 }))

let router
const montar = (ruta) => {
  router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
const ruta = () => router.state.location.pathname
const h1 = (nombre) => screen.findByRole('heading', { level: 1, name: nombre }, { timeout: ESPERA })
const tarjeta = (nombre) => within(screen.getByRole('region', { name: /Indicadores/ })).getByText(nombre).closest('div')

let vigencia
beforeEach(() => {
  localStorage.clear()
  sessionStorage.setItem('bienvenida-barbero-vista', '1')
  sesion()
  fijarEscritorio()
  vigencia = VIGENTE
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 2, nombre: 'Leo Ramírez', cargo: 'Barbero Senior', especialidad: 'Degradados y barba', foto: null }])
  vi.mocked(api.obtenerSesion).mockImplementation(async () => ({ usuario: {}, vigencia }))
  vi.mocked(api.obtenerResumenBarbero).mockResolvedValue({
    fecha: hoyISO(), citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null, ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 0,
  })
  vi.mocked(api.obtenerCitasPorConfirmar).mockResolvedValue({ total: 0, tope: 100, items: [] })
  vi.mocked(api.obtenerMisEstadisticas).mockResolvedValue(estadisticas())
  vi.mocked(api.obtenerMisIngresos).mockResolvedValue({ agrupar: 'dia', puntos: serieDia((i) => (i === 3 ? 80000 : 0)), anteriores: serieDia() })
  vi.mocked(api.obtenerMisServiciosTop).mockResolvedValue({
    periodo: PERIODO,
    servicios: [
      { id: 1, nombre: 'Corte clásico', cantidad: 3, ingresos: 90000 },
      { id: 2, nombre: 'Barba', cantidad: 1, ingresos: 30000 },
    ],
  })
})

afterEach(() => {
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('Menú y rutas', () => {
  it('el menú del barbero tiene Resumen, Mis citas, Mi rendimiento, Mi cuenta y Configuración', async () => {
    montar('/panel/rendimiento')
    await h1('Mi rendimiento')
    const lateral = screen.getByRole('complementary', { name: 'Menú de navegación' })
    const enlaces = within(within(lateral).getByRole('navigation')).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])
    expect(enlaces).toEqual([
      ['Resumen', '/panel'],
      ['Mis citas', '/panel/citas'],
      ['Mi rendimiento', '/panel/rendimiento'],
      ['Mi cuenta', '/panel/cuenta'],
      ['Configuración', '/panel/configuracion'],
    ])
    expect(within(lateral).getByRole('link', { name: 'Mi rendimiento' })).toHaveAttribute('aria-current', 'page')
    expect(within(lateral).getByRole('link', { name: 'Resumen' })).not.toHaveAttribute('aria-current')
  }, ESPERA_TEST)

  it('desde el menú se llega a Mi cuenta', async () => {
    montar('/panel/rendimiento')
    await h1('Mi rendimiento')
    await userEvent.click(screen.getByRole('link', { name: 'Mi cuenta' }))
    expect(await h1('Mi cuenta')).toBeInTheDocument()
    expect(ruta()).toBe('/panel/cuenta')
  }, ESPERA_TEST)

  it('guard: sin sesión van a /acceso y el admin no entra (va a /admin)', async () => {
    localStorage.clear()
    montar('/panel/cuenta')
    await waitFor(() => expect(ruta()).toBe('/acceso'), { timeout: ESPERA })
  }, ESPERA_TEST)

  it('guard: un admin que abre /panel/rendimiento vuelve a /admin y no se piden sus estadísticas', async () => {
    localStorage.clear()
    sesion('admin')
    vi.mocked(api.obtenerEstadisticas).mockResolvedValue(estadisticas())
    montar('/panel/rendimiento')
    await waitFor(() => expect(ruta()).toBe('/admin'), { timeout: ESPERA })
    expect(api.obtenerMisEstadisticas).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it('rutas desconocidas bajo /panel vuelven a /panel (también /panel/cuenta/otra)', async () => {
    montar('/panel/cuenta/otra')
    await waitFor(() => expect(ruta()).toBe('/panel'), { timeout: ESPERA })
  }, ESPERA_TEST)
})

describe('Mi rendimiento', () => {
  it('pide SUS estadísticas (nunca las del admin) y muestra las cuatro tarjetas con formato', async () => {
    montar('/panel/rendimiento')
    await screen.findByText('$120.000')

    expect(api.obtenerMisEstadisticas).toHaveBeenCalledWith(expect.any(String), 'hoy')
    expect(api.obtenerEstadisticas).not.toHaveBeenCalled()
    expect(api.obtenerIngresos).not.toHaveBeenCalled()
    expect(api.obtenerServiciosTop).not.toHaveBeenCalled()
    const region = screen.getByRole('region', { name: /Indicadores/ })
    expect(within(region).getAllByText(/^(Cortes|Ingresos|Ticket promedio|Canceladas)$/).map((e) => e.textContent)).toEqual([
      'Cortes', 'Ingresos', 'Ticket promedio', 'Canceladas',
    ])
    expect(within(tarjeta('Cortes')).getByText('4')).toBeInTheDocument()
    expect(within(tarjeta('Ingresos')).getByText('$120.000')).toBeInTheDocument()
    expect(within(tarjeta('Ticket promedio')).getByText('$30.000')).toBeInTheDocument()
    expect(within(tarjeta('Canceladas')).getByText('1')).toBeInTheDocument()
    // Comparación con el período anterior (4 contra 5 cortes → baja)
    expect(within(tarjeta('Cortes')).getByText(/20% menos que en el período anterior/)).toBeInTheDocument()
    expect(screen.getByText(/Comparado con ayer/)).toBeInTheDocument()
  }, ESPERA_TEST)

  it('cambiar el período vuelve a pedir indicadores y servicios con ese período', async () => {
    montar('/panel/rendimiento')
    await screen.findByText('$120.000')
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }))

    await waitFor(() => expect(api.obtenerMisEstadisticas).toHaveBeenLastCalledWith(expect.any(String), 'mes'))
    expect(api.obtenerMisServiciosTop).toHaveBeenLastCalledWith(expect.any(String), 'mes', 5)
    expect(screen.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true')
  }, ESPERA_TEST)

  it('gráfico de ingresos y servicios más pedidos accesibles: role="img", aria-label y tabla oculta', async () => {
    montar('/panel/rendimiento')
    const grafico = await screen.findByRole('img', { name: /ingresos por día/ })
    expect(grafico).toHaveAttribute('aria-label')
    expect(api.obtenerMisIngresos).toHaveBeenCalledWith(expect.any(String), 'dia')
    expect(grafico.closest('section').querySelector('.sr-only table')).not.toBeNull()

    const tabla = await screen.findByRole('table', { name: /Servicios más pedidos/ })
    expect(tabla.closest('.sr-only')).not.toBeNull()
    expect(within(tabla).getByRole('row', { name: /Corte clásico/ })).toHaveTextContent('3')
  }, ESPERA_TEST)

  it('barbero sin completadas: ceros claros ($0, 0), mensaje y sin NaN', async () => {
    vi.mocked(api.obtenerMisEstadisticas).mockResolvedValue(estadisticas({ actual: CEROS, previo: CEROS }))
    vi.mocked(api.obtenerMisIngresos).mockResolvedValue({ agrupar: 'dia', puntos: serieDia(), anteriores: serieDia() })
    vi.mocked(api.obtenerMisServiciosTop).mockResolvedValue({ periodo: PERIODO, servicios: [] })
    montar('/panel/rendimiento')

    expect(await screen.findByText('No tienes cortes completados en este período.')).toBeInTheDocument()
    expect(within(tarjeta('Ingresos')).getByText('$0')).toBeInTheDocument()
    expect(within(tarjeta('Ticket promedio')).getByText('$0')).toBeInTheDocument()
    expect(within(tarjeta('Cortes')).getByText('0')).toBeInTheDocument()
    expect(screen.queryByText(/Gratis/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|∞/)
    expect(await screen.findByText('Todavía no hay ingresos en este rango.')).toBeInTheDocument()
    expect(screen.getByText('Aún no hay servicios completados en este período.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /ingresos por día/ })).toBeNull()
  }, ESPERA_TEST)

  it('con completadas no sale el mensaje de vacío', async () => {
    montar('/panel/rendimiento')
    await screen.findByText('$120.000')
    expect(screen.queryByText('No tienes cortes completados en este período.')).toBeNull()
  }, ESPERA_TEST)

  it('mientras carga avisa con role="status"', async () => {
    vi.mocked(api.obtenerMisEstadisticas).mockReturnValue(new Promise(() => {}))
    montar('/panel/rendimiento')
    expect(await screen.findByText('Cargando indicadores...', {}, { timeout: ESPERA })).toHaveAttribute('role', 'status')
  }, ESPERA_TEST)

  it('errores con ErrorCarga y "Reintentar" en indicadores, ingresos y servicios', async () => {
    vi.mocked(api.obtenerMisEstadisticas).mockRejectedValueOnce(new Error('falló'))
    vi.mocked(api.obtenerMisIngresos).mockRejectedValueOnce(new Error('falló'))
    vi.mocked(api.obtenerMisServiciosTop).mockRejectedValueOnce(new Error('falló'))
    montar('/panel/rendimiento')

    for (const texto of ['No pudimos cargar los indicadores.', 'No pudimos cargar los ingresos.', 'No pudimos cargar los servicios.']) {
      const alerta = (await screen.findByText(texto, {}, { timeout: ESPERA })).closest('[role="alert"]')
      await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))
    }
    expect(await screen.findByText('$120.000')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /ingresos por día/ })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: /Servicios más pedidos/ })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('el aviso de por confirmar sigue visible y la bienvenida (ya vista) no vuelve', async () => {
    vi.mocked(api.obtenerResumenBarbero).mockResolvedValue({
      fecha: hoyISO(), citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null, ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 2,
    })
    montar('/panel/rendimiento')
    expect(await screen.findByText(/No has confirmado 2 citas/, {}, { timeout: ESPERA })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  }, ESPERA_TEST)

  it('el aviso de caducidad (por vencer) también sale en esta ruta', async () => {
    vigencia = POR_VENCER
    montar('/panel/rendimiento')
    await h1('Mi rendimiento')
    expect(await screen.findByText(/Tu contraseña caduca en 2 días/)).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('Mi cuenta', () => {
  it('muestra, solo lectura, avatar, nombre, cargo, especialidad y usuario', async () => {
    montar('/panel/cuenta')
    await h1('Mi cuenta')
    const datos = screen.getByRole('region', { name: 'Tus datos' })

    expect(within(datos).getByRole('img', { name: 'Avatar de Leo Ramírez' })).toBeInTheDocument()
    expect(within(datos).getByText('Leo Ramírez')).toBeInTheDocument()
    expect(within(datos).getByText('Barbero Senior')).toBeInTheDocument()
    expect(within(datos).getByText('Degradados y barba')).toBeInTheDocument()
    expect(within(datos).getByText('leo')).toBeInTheDocument()
    expect(within(datos).queryByRole('textbox')).toBeNull()
    expect(within(datos).queryByRole('button')).toBeNull()
  }, ESPERA_TEST)

  it('sin especialidad dice "No indicada"', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 2, nombre: 'Leo Ramírez', cargo: '', foto: null }])
    montar('/panel/cuenta')
    await h1('Mi cuenta')
    expect(screen.getByText('No indicada')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('vigente: fecha en que vence, días que faltan y quién puede restablecerla; sin formulario ni cambio libre', async () => {
    montar('/panel/cuenta')
    await h1('Mi cuenta')

    expect(screen.getByText('Tu contraseña está vigente.')).toBeInTheDocument()
    expect(screen.getByText(/Vence el sábado, 14 de noviembre de 2026; faltan 41 días/)).toBeInTheDocument()
    expect(screen.getByText(/Solo el administrador puede restablecer tu contraseña antes de que venza/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull()
    expect(screen.queryByRole('button', { name: /Cambiar contraseña/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar contraseña' })).toBeNull()
    expect(api.cambiarContrasena).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it('con 3 días todavía es vigente (sin formulario)', async () => {
    vigencia = { estado: 'vigente', dias_restantes: 3, vence_en: '2026-10-08' }
    montar('/panel/cuenta')
    await h1('Mi cuenta')
    expect(screen.getByText(/faltan 3 días/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull()
  }, ESPERA_TEST)

  it('por vencer: aviso con los días y un ÚNICO formulario (el del layout no se duplica) que cambia la contraseña', async () => {
    vigencia = POR_VENCER
    vi.mocked(api.cambiarContrasena).mockResolvedValue({ mensaje: 'ok', vigencia: VIGENTE })
    montar('/panel/cuenta')
    await h1('Mi cuenta')

    expect(await screen.findAllByText(/Tu contraseña caduca en 2 días/)).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(screen.getAllByLabelText('Contraseña actual')).toHaveLength(1)

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'actual123')
    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'nueva12345')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'nueva12345')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    await waitFor(() => expect(api.cambiarContrasena).toHaveBeenCalledWith(expect.any(String), 'actual123', 'nueva12345'))
    expect(await screen.findByText('Contraseña actualizada. La nueva vale 60 días.')).toBeInTheDocument()
    // Ya vigente: el aviso y el formulario desaparecen y se muestra el estado nuevo
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull()
    expect(screen.getByText('Tu contraseña está vigente.')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('caducada: la pantalla obligatoria sustituye al panel (no hay Mi cuenta ni se piden datos)', async () => {
    vigencia = CADUCADA
    montar('/panel/cuenta')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu contraseña caducó' }, { timeout: ESPERA })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeNull()
    expect(api.obtenerResumenBarbero).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it('"Cerrar sesión" pide confirmación y luego cierra la sesión y lleva al acceso', async () => {
    montar('/panel/cuenta')
    await h1('Mi cuenta')
    await userEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Cerrar sesión' }))
    expect(ruta()).toBe('/panel/cuenta')
    await userEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(ruta()).toBe('/acceso'))
    expect(localStorage.getItem('token')).toBeNull()
  }, ESPERA_TEST)

  it('el aviso persistente de por confirmar sigue en esta ruta', async () => {
    vi.mocked(api.obtenerResumenBarbero).mockResolvedValue({
      fecha: hoyISO(), citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null, ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 1,
    })
    montar('/panel/cuenta')
    expect(await screen.findByText(/No has confirmado 1 cita/, {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)
})
