import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Resumen from '../pages/admin/Resumen'
import * as api from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { usuario: 'admin', rol: 'admin' } }),
}))

const PERIODO_HOY = { clave: 'hoy', desde: '2026-10-04', hasta: '2026-10-04' }
const CEROS = { citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 }

const estadisticas = (sobrescribir = {}) => ({
  periodo: PERIODO_HOY,
  anterior: { desde: '2026-10-03', hasta: '2026-10-03' },
  actual: { citas: 9, completadas: 6, canceladas: 1, ingresos: 185000, ticket_promedio: 30833 },
  previo: { citas: 11, completadas: 8, canceladas: 0, ingresos: 220000, ticket_promedio: 27500 },
  ...sobrescribir,
})

const serieDia = (valor = () => 0) =>
  Array.from({ length: 30 }, (_, i) => ({
    fecha: `2026-09-${String(i + 1).padStart(2, '0')}`,
    ingresos: valor(i),
    cortes: valor(i) > 0 ? 1 : 0,
  }))

const cita = (id, sobrescribir = {}) => ({
  id,
  cliente: `Cliente ${id}`,
  correo: 'c@example.com',
  telefono: '3001234567',
  fecha: '2026-10-05',
  hora: '10:00:00',
  estado: 'pendiente',
  servicio_nombre: 'Corte clásico',
  barbero_nombre: 'Leo',
  vencida: false,
  ...sobrescribir,
})

const montar = () =>
  render(
    <MemoryRouter>
      <Resumen />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.mocked(api.obtenerEstadisticas).mockResolvedValue(estadisticas())
  vi.mocked(api.obtenerIngresos).mockResolvedValue({
    agrupar: 'dia',
    puntos: serieDia((i) => (i === 3 ? 80000 : 0)),
    anteriores: serieDia(),
  })
  vi.mocked(api.obtenerServiciosTop).mockResolvedValue({
    periodo: PERIODO_HOY,
    servicios: [
      { id: 1, nombre: 'Corte clásico', cantidad: 4, ingresos: 100000 },
      { id: 2, nombre: 'Barba', cantidad: 2, ingresos: 30000 },
    ],
  })
  vi.mocked(api.obtenerCitasAdmin).mockResolvedValue({ items: [cita(1)], total: 1, pagina: 1, limite: 10 })
})

// Solo dentro de la sección de indicadores: "Ingresos" y "Canceladas" también aparecen en otros paneles.
const tarjeta = (nombre) =>
  within(screen.getByRole('region', { name: /Indicadores/ })).getByText(nombre).closest('div')

describe('Resumen: indicadores', () => {
  it('muestra las cinco tarjetas con sus cifras formateadas', async () => {
    montar()
    await screen.findByText('$185.000')

    expect(within(tarjeta('Ingresos')).getByText('$185.000')).toBeInTheDocument()
    expect(within(tarjeta('Citas')).getByText('9')).toBeInTheDocument()
    expect(within(tarjeta('Completadas')).getByText('6')).toBeInTheDocument()
    expect(within(tarjeta('Canceladas')).getByText('1')).toBeInTheDocument()
    expect(within(tarjeta('Ticket promedio')).getByText('$30.833')).toBeInTheDocument()
  })

  it('las cifras van en Poppins semibold', async () => {
    montar()
    expect(await screen.findByText('$185.000')).toHaveClass('font-poppins', 'font-semibold')
  })

  it('calcula el delta contra el período anterior: baja, sube y "—" cuando no hay base', async () => {
    montar()
    await screen.findByText('$185.000')

    expect(within(tarjeta('Ingresos')).getByText('16%')).toBeInTheDocument()
    expect(within(tarjeta('Ingresos')).getByText(/16% menos que en el período anterior/)).toBeInTheDocument()
    expect(within(tarjeta('Ticket promedio')).getByText(/12% más/)).toBeInTheDocument()
    // Canceladas: el período anterior tenía 0 → sin base
    const canceladas = tarjeta('Canceladas')
    expect(within(canceladas).getByText('—')).toBeInTheDocument()
    expect(within(canceladas).getByText(/Sin base de comparación/)).toBeInTheDocument()
  })

  it('que suban las canceladas se pinta como malo (rojo) y que suban los ingresos como bueno (verde)', async () => {
    vi.mocked(api.obtenerEstadisticas).mockResolvedValue(
      estadisticas({
        actual: { citas: 10, completadas: 8, canceladas: 4, ingresos: 300000, ticket_promedio: 30000 },
        previo: { citas: 10, completadas: 8, canceladas: 2, ingresos: 200000, ticket_promedio: 30000 },
      })
    )
    montar()
    await screen.findByText('$300.000')

    expect(within(tarjeta('Canceladas')).getByText('100%').parentElement).toHaveClass('text-red-400')
    expect(within(tarjeta('Ingresos')).getByText('50%').parentElement).toHaveClass('text-emerald-400')
  })

  it('con todo en cero no aparece NaN, Infinity ni undefined', async () => {
    vi.mocked(api.obtenerEstadisticas).mockResolvedValue(estadisticas({ actual: CEROS, previo: CEROS }))
    montar()
    await screen.findByText('Ticket promedio')
    await waitFor(() => expect(within(tarjeta('Ingresos')).getByText('$0')).toBeInTheDocument())

    expect(document.body.textContent).not.toMatch(/NaN|Infinity|∞|undefined/)
    expect(screen.getAllByText('—')).toHaveLength(5)
  })

  it('muestra el período comparado de forma explícita', async () => {
    montar()
    expect(await screen.findByText('Comparado con ayer (3 oct)')).toBeInTheDocument()
  })

  it('el selector pide el nuevo período, marca el botón activo y actualiza el texto de comparación', async () => {
    montar()
    await screen.findByText('$185.000')
    const grupo = screen.getByRole('group', { name: 'Período de los indicadores' })
    expect(within(grupo).getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true')

    vi.mocked(api.obtenerEstadisticas).mockResolvedValue(
      estadisticas({
        periodo: { clave: 'mes', desde: '2026-10-01', hasta: '2026-10-04' },
        anterior: { desde: '2026-09-01', hasta: '2026-09-04' },
      })
    )
    await userEvent.click(within(grupo).getByRole('button', { name: 'Mes' }))

    expect(api.obtenerEstadisticas).toHaveBeenLastCalledWith('tok', 'mes')
    expect(api.obtenerServiciosTop).toHaveBeenLastCalledWith('tok', 'mes', 5)
    expect(within(grupo).getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo).getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false')
    expect(
      await screen.findByText('Comparado con el mismo tramo del mes anterior (1 sept – 4 sept)')
    ).toBeInTheDocument()
  })

  it('muestra "Cargando" mientras llegan los datos', async () => {
    vi.mocked(api.obtenerEstadisticas).mockReturnValue(new Promise(() => {}))
    montar()
    expect(await screen.findByText('Cargando indicadores...')).toBeInTheDocument()
  })

  it('si falla muestra el error con "Reintentar", que vuelve a pedir los datos', async () => {
    vi.mocked(api.obtenerEstadisticas).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    montar()

    const alerta = await screen.findByText('No pudimos cargar los indicadores.')
    await userEvent.click(within(alerta.closest('[role="alert"]')).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('$185.000')).toBeInTheDocument()
    expect(api.obtenerEstadisticas).toHaveBeenCalledTimes(2)
  })
})

describe('Resumen: gráfico de ingresos', () => {
  it('pide los ingresos por día, dibuja el gráfico con su tabla y permite pasar a meses', async () => {
    montar()
    const imagen = await screen.findByRole('img', { name: /ingresos por día/ })
    expect(imagen).toBeInTheDocument()
    expect(api.obtenerIngresos).toHaveBeenCalledWith('tok', 'dia')

    vi.mocked(api.obtenerIngresos).mockResolvedValue({
      agrupar: 'mes',
      puntos: Array.from({ length: 12 }, (_, i) => ({ mes: `2026-${String(i + 1).padStart(2, '0')}`, ingresos: i * 1000, cortes: i })),
      anteriores: Array.from({ length: 12 }, (_, i) => ({ mes: `2025-${String(i + 1).padStart(2, '0')}`, ingresos: 0, cortes: 0 })),
    })
    await userEvent.click(screen.getByRole('button', { name: 'Por mes' }))

    expect(await screen.findByRole('img', { name: /ingresos por mes/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Por mes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('vacío: sin ingresos en el rango muestra un aviso en lugar del gráfico', async () => {
    vi.mocked(api.obtenerIngresos).mockResolvedValue({ agrupar: 'dia', puntos: serieDia(), anteriores: serieDia() })
    montar()

    expect(await screen.findByText('Todavía no hay ingresos en este rango.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /ingresos por día/ })).toBeNull()
  })

  it('error con reintento', async () => {
    vi.mocked(api.obtenerIngresos).mockRejectedValueOnce(new Error('falló'))
    montar()

    const alerta = (await screen.findByText('No pudimos cargar los ingresos.')).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('img', { name: /ingresos por día/ })).toBeInTheDocument()
  })
})

describe('Resumen: servicios más pedidos', () => {
  it('dibuja las barras con su tabla de respaldo', async () => {
    montar()
    const tabla = await screen.findByRole('table', { name: /Servicios más pedidos/ })

    expect(within(tabla).getByRole('row', { name: /Corte clásico/ })).toHaveTextContent('4')
    expect(screen.getByRole('img', { name: /servicios más pedidos/ })).toBeInTheDocument()
  })

  it('vacío y error', async () => {
    vi.mocked(api.obtenerServiciosTop)
      .mockRejectedValueOnce(new Error('falló'))
      .mockResolvedValue({ periodo: PERIODO_HOY, servicios: [] })
    montar()

    const alerta = (await screen.findByText('No pudimos cargar los servicios.')).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Aún no hay servicios completados en este período.')).toBeInTheDocument()
  })
})

describe('Resumen: citas recientes', () => {
  it('abre en "Próximas" y muestra la cita con su estado y el barbero a cargo', async () => {
    montar()
    await screen.findAllByText('Cliente 1')

    expect(api.obtenerCitasAdmin).toHaveBeenCalledWith('tok', {
      pestana: 'proximas', q: '', desde: '', hasta: '', limite: 10,
    })
    expect(screen.getByRole('button', { name: 'Próximas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Leo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
    expect(screen.getByText('Mostrando 1 de 1')).toBeInTheDocument()
  })

  it('las pestañas piden "todas" y "canceladas"', async () => {
    montar()
    await screen.findAllByText('Cliente 1')

    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))
    expect(api.obtenerCitasAdmin).toHaveBeenLastCalledWith('tok', expect.objectContaining({ pestana: 'todas' }))

    await userEvent.click(screen.getByRole('button', { name: 'Canceladas' }))
    expect(api.obtenerCitasAdmin).toHaveBeenLastCalledWith('tok', expect.objectContaining({ pestana: 'canceladas' }))
    expect(screen.getByRole('button', { name: 'Canceladas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('la búsqueda se envía después de una breve pausa, no en cada tecla', async () => {
    montar()
    await screen.findAllByText('Cliente 1')
    const llamadasIniciales = vi.mocked(api.obtenerCitasAdmin).mock.calls.length

    await userEvent.type(screen.getByLabelText('Buscar'), 'ana')

    expect(vi.mocked(api.obtenerCitasAdmin).mock.calls.length).toBe(llamadasIniciales)
    await waitFor(() =>
      expect(api.obtenerCitasAdmin).toHaveBeenLastCalledWith('tok', expect.objectContaining({ q: 'ana' }))
    )
    expect(vi.mocked(api.obtenerCitasAdmin).mock.calls.length).toBe(llamadasIniciales + 1)
  })

  it('el filtro por fecha usa desde y hasta con el mismo día', async () => {
    montar()
    await screen.findAllByText('Cliente 1')

    await userEvent.type(screen.getByLabelText('Fecha'), '2026-10-05')

    expect(api.obtenerCitasAdmin).toHaveBeenLastCalledWith(
      'tok',
      expect.objectContaining({ desde: '2026-10-05', hasta: '2026-10-05' })
    )
  })

  it('marca "Vencida" a las pendientes de días pasados', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockResolvedValue({
      items: [cita(1, { vencida: true, fecha: '2026-10-01' }), cita(2, { estado: 'completada' })],
      total: 2, pagina: 1, limite: 10,
    })
    montar()
    await screen.findAllByText('Cliente 1')

    expect(screen.getAllByText('Vencida').length).toBeGreaterThan(0)
    expect(screen.queryByText('Pendiente')).toBeNull()
    expect(screen.getAllByText('Completada').length).toBeGreaterThan(0)
  })

  it('vacío sin filtros: mensaje de la pestaña; con filtros: "Limpiar filtros" los quita', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockResolvedValue({ items: [], total: 0, pagina: 1, limite: 10 })
    montar()

    expect(await screen.findByText('No hay citas próximas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()

    await userEvent.type(screen.getByLabelText('Buscar'), 'zzz')
    const limpiar = await screen.findByRole('button', { name: 'Limpiar filtros' })
    expect(screen.getByText('No hay citas que coincidan con la búsqueda.')).toBeInTheDocument()

    await userEvent.click(limpiar)
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
    expect(await screen.findByText('No hay citas próximas.')).toBeInTheDocument()
  })

  it('cargando y error con reintento', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockReturnValueOnce(new Promise(() => {}))
    const { unmount } = montar()
    expect(await screen.findByText('Cargando citas...')).toBeInTheDocument()
    unmount()

    vi.mocked(api.obtenerCitasAdmin).mockRejectedValueOnce(new Error('falló'))
    montar()
    const alerta = (await screen.findByText('No pudimos cargar las citas.')).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))
    expect((await screen.findAllByText('Cliente 1')).length).toBeGreaterThan(0)
  })

  it('"Ver todas las citas" lleva a /admin/citas conservando los filtros', async () => {
    montar()
    await screen.findAllByText('Cliente 1')
    await userEvent.click(screen.getByRole('button', { name: 'Canceladas' }))
    await screen.findAllByText('Cliente 1')

    expect(screen.getByRole('link', { name: 'Ver todas las citas' })).toHaveAttribute(
      'href',
      '/admin/citas?pestana=canceladas'
    )
  })
})
