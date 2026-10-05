import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Reportes from '../pages/admin/Reportes'
import * as api from '../services/api'
import { guardarArchivo } from '../utils/descarga'

vi.mock('../services/api')
vi.mock('../utils/descarga', () => ({ guardarArchivo: vi.fn() }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { usuario: 'admin', rol: 'admin' } }),
}))

// 23:30 del 4 de octubre en Bogotá: en UTC ya es el 5. "Hoy" del reporte debe ser el 4.
const HOY = '2026-10-04'
const BOGOTA_2330 = '2026-10-05T04:30:00Z'

const reporte = (extra = {}) => ({
  fecha: HOY,
  total_cortes: 3,
  ingresos: 95000,
  ticket_promedio: 31667,
  canceladas: 2,
  pendientes_sin_cerrar: 0,
  servicios_mas_pedidos: [
    { nombre: 'Corte clásico', cantidad: 2, ingresos: 50000 },
    { nombre: 'Barba', cantidad: 1, ingresos: 45000 },
  ],
  ...extra,
})

const Ubicacion = () => <output data-testid="ubicacion">{useLocation().search}</output>

const montar = (ruta = '/admin/reportes') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Reportes />
      <Ubicacion />
    </MemoryRouter>
  )

const esperarCarga = () => screen.findByRole('heading', { name: 'Cifras del día' })
const campoDia = () => screen.getByLabelText('Día')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(BOGOTA_2330))
  vi.mocked(api.obtenerReporteDiario).mockImplementation(async (_t, fecha) => reporte({ fecha }))
  vi.mocked(api.descargarReporteDiarioCsv).mockResolvedValue({ blob: new Blob(['x']), nombre: 'reporte-diario-2026-10-04.csv' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Reportes: selector de día y URL', () => {
  it('por defecto muestra hoy en Bogotá (4 de octubre, aunque en UTC ya sea el 5) y lo pide con el token', async () => {
    montar()
    await esperarCarga()

    expect(api.obtenerReporteDiario).toHaveBeenCalledWith('tok', HOY)
    expect(campoDia()).toHaveValue(HOY)
    expect(screen.getByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument()
  })

  it('el calendario no deja pasar de hoy y "Día siguiente" está deshabilitado en hoy', async () => {
    montar()
    await esperarCarga()

    expect(campoDia()).toHaveAttribute('max', HOY)
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Día anterior' })).toBeEnabled()
  })

  it('"Día anterior" pide el día de ayer y lo guarda en la URL (?fecha=)', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Día anterior' }))

    expect(api.obtenerReporteDiario).toHaveBeenLastCalledWith('tok', '2026-10-03')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('?fecha=2026-10-03')
    expect(campoDia()).toHaveValue('2026-10-03')
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeEnabled()
  })

  it('"Día siguiente" avanza un día y se vuelve a deshabilitar al llegar a hoy; cruza el cambio de mes', async () => {
    montar('/admin/reportes?fecha=2026-09-30')
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Día siguiente' }))
    expect(campoDia()).toHaveValue('2026-10-01')

    await userEvent.click(screen.getByRole('button', { name: 'Día anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Día anterior' }))
    expect(campoDia()).toHaveValue('2026-09-29')
  })

  it('la fecha de la URL se respeta al recargar', async () => {
    montar('/admin/reportes?fecha=2026-09-15')
    await esperarCarga()
    expect(api.obtenerReporteDiario).toHaveBeenCalledWith('tok', '2026-09-15')
    expect(campoDia()).toHaveValue('2026-09-15')
  })

  it.each(['2026-02-31', 'hoy', '2026-10-05', '2099-01-01', '', '2026-9-1'])('una fecha inválida o futura en la URL (%s) se ignora y se usa hoy', async (valor) => {
    montar(`/admin/reportes?fecha=${valor}`)
    await esperarCarga()
    expect(api.obtenerReporteDiario).toHaveBeenCalledWith('tok', HOY)
    expect(api.obtenerReporteDiario).not.toHaveBeenCalledWith('tok', valor)
  })

  it('escribir una fecha futura en el calendario la recorta a hoy; un campo vacío no cambia nada', async () => {
    montar('/admin/reportes?fecha=2026-10-01')
    await esperarCarga()

    fireEvent.change(campoDia(), { target: { value: '2026-10-09' } })
    expect(campoDia()).toHaveValue(HOY)
    expect(api.obtenerReporteDiario).toHaveBeenLastCalledWith('tok', HOY)

    fireEvent.change(campoDia(), { target: { value: '' } })
    expect(campoDia()).toHaveValue(HOY)
    expect(api.obtenerReporteDiario).toHaveBeenLastCalledWith('tok', HOY)
  })

  it('elegir un día pasado en el calendario lo pide', async () => {
    montar()
    await esperarCarga()
    fireEvent.change(campoDia(), { target: { value: '2026-08-20' } })
    expect(api.obtenerReporteDiario).toHaveBeenLastCalledWith('tok', '2026-08-20')
  })

  it('los botones y el campo tienen nombre accesible', async () => {
    montar()
    await esperarCarga()
    for (const nombre of ['Día anterior', 'Día siguiente', 'Descargar CSV', 'Imprimir']) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument()
    }
    expect(screen.getByRole('group', { name: 'Día del reporte' })).toBeInTheDocument()
  })
})

describe('Reportes: contenido', () => {
  it('muestra total de cortes, ingresos, ticket promedio y canceladas aparte', async () => {
    montar()
    await esperarCarga()

    const cifras = within(screen.getByRole('heading', { name: 'Cifras del día' }).closest('section'))
    expect(cifras.getByText('Total de cortes').nextSibling).toHaveTextContent('3')
    expect(cifras.getByText('Ingresos').nextSibling).toHaveTextContent('$95.000')
    expect(cifras.getByText('Ticket promedio').nextSibling).toHaveTextContent('$31.667')
    expect(cifras.getByText('Canceladas').nextSibling).toHaveTextContent('2')
    expect(cifras.getByText('Aparte: no suman ingresos')).toBeInTheDocument()
  })

  it('los servicios más pedidos van en una tabla legible: título, encabezados, filas y cifras', async () => {
    montar()
    await esperarCarga()

    const tabla = screen.getByRole('table', { name: /Servicios completados el .* de más a menos pedidos/ })
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Servicio', 'Cantidad', 'Ingresos'])
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas.map((f) => [...f.children].map((c) => c.textContent))).toEqual([
      ['Corte clásico', '2', '$50.000'],
      ['Barba', '1', '$45.000'],
    ])
    expect(within(filas[0]).getByRole('rowheader')).toHaveTextContent('Corte clásico')
  })

  it('un servicio de nombre largo sin espacios se parte (wrap-anywhere) en vez de ensanchar la página', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(
      reporte({ servicios_mas_pedidos: [{ nombre: 'X'.repeat(150), cantidad: 1, ingresos: 1000 }] })
    )
    montar()
    await esperarCarga()
    expect(screen.getByRole('rowheader')).toHaveClass('wrap-anywhere')
  })

  it('sin cortes completados pero con canceladas muestra las cifras y dice que no hubo cortes', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(
      reporte({ total_cortes: 0, ingresos: 0, ticket_promedio: 0, canceladas: 2, servicios_mas_pedidos: [] })
    )
    montar()
    await esperarCarga()
    expect(screen.getByText('Ningún corte completado este día.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByText('$0')).toHaveLength(2) // ingresos y ticket promedio
  })
})

describe('Reportes: citas sin cerrar', () => {
  it('avisa cuántas hay, aclara que las cierran los barberos y que solo cuenta las completadas, y enlaza a /admin/citas filtrado a ese día', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(reporte({ pendientes_sin_cerrar: 3 }))
    montar()
    await esperarCarga()

    const aviso = screen.getByText(/Hay 3 citas sin cerrar: las cierran los barberos, y el reporte solo cuenta las completadas\./)
    expect(aviso).toBeInTheDocument()
    expect(within(aviso).getByRole('link', { name: 'Ver las citas de este día' })).toHaveAttribute(
      'href', `/admin/citas?pestana=todas&desde=${HOY}&hasta=${HOY}`
    )
  })

  it('en singular dice "1 cita" y el enlace lleva el día que se está viendo', async () => {
    vi.mocked(api.obtenerReporteDiario).mockImplementation(async (_t, fecha) => reporte({ fecha, pendientes_sin_cerrar: 1 }))
    montar('/admin/reportes?fecha=2026-09-15')
    await esperarCarga()
    expect(screen.getByText(/Hay 1 cita sin cerrar/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver las citas de este día' })).toHaveAttribute('href', '/admin/citas?pestana=todas&desde=2026-09-15&hasta=2026-09-15')
  })

  it('sin pendientes no hay aviso', async () => {
    montar()
    await esperarCarga()
    expect(screen.queryByText(/sin cerrar/)).toBeNull()
  })

  it('si solo hay pendientes (nada completado) igual se muestra el reporte con el aviso', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(
      reporte({ total_cortes: 0, ingresos: 0, ticket_promedio: 0, canceladas: 0, pendientes_sin_cerrar: 4, servicios_mas_pedidos: [] })
    )
    montar()
    await esperarCarga()
    expect(screen.getByText(/Hay 4 citas sin cerrar/)).toBeInTheDocument()
  })
})

describe('Reportes: estados', () => {
  it('muestra "Cargando" y luego el reporte', async () => {
    montar()
    expect(screen.getByText('Cargando reporte...')).toBeInTheDocument()
    await esperarCarga()
  })

  it('un día sin citas muestra el aviso de día vacío (SinResultados) y no la tabla', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(
      reporte({ total_cortes: 0, ingresos: 0, ticket_promedio: 0, canceladas: 0, pendientes_sin_cerrar: 0, servicios_mas_pedidos: [] })
    )
    montar()
    expect(await screen.findByText('No hay citas registradas en este día.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(campoDia()).toBeInTheDocument() // se puede seguir cambiando de día
  })

  it('si falla muestra el error con "Reintentar", que vuelve a pedir el mismo día', async () => {
    vi.mocked(api.obtenerReporteDiario).mockRejectedValueOnce(new Error('sin conexión'))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el reporte')
    expect(screen.queryByRole('table')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await esperarCarga()
    expect(api.obtenerReporteDiario).toHaveBeenCalledTimes(2)
    expect(api.obtenerReporteDiario).toHaveBeenLastCalledWith('tok', HOY)
  })
})

describe('Reportes: descargar CSV', () => {
  it('pide el CSV del día que se ve con el token y lo guarda con el nombre que devuelve', async () => {
    const blob = new Blob(['a;b'])
    vi.mocked(api.descargarReporteDiarioCsv).mockResolvedValue({ blob, nombre: 'reporte-diario-2026-09-15.csv' })
    montar('/admin/reportes?fecha=2026-09-15')
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))

    expect(api.descargarReporteDiarioCsv).toHaveBeenCalledWith('tok', '2026-09-15')
    expect(guardarArchivo).toHaveBeenCalledWith(blob, 'reporte-diario-2026-09-15.csv')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('mientras descarga el botón se deshabilita y dice "Descargando..."', async () => {
    let terminar
    vi.mocked(api.descargarReporteDiarioCsv).mockReturnValue(new Promise((resolver) => (terminar = resolver)))
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))

    expect(screen.getByRole('button', { name: 'Descargando...' })).toBeDisabled()
    terminar({ blob: new Blob(['x']), nombre: 'r.csv' })
    expect(await screen.findByRole('button', { name: 'Descargar CSV' })).toBeEnabled()
  })

  it('si la descarga falla muestra el error y no guarda nada', async () => {
    vi.mocked(api.descargarReporteDiarioCsv).mockRejectedValue(new Error('No se pudo descargar el reporte'))
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo descargar el reporte')
    expect(guardarArchivo).not.toHaveBeenCalled()
  })
})

describe('Reportes: imprimir', () => {
  it('"Imprimir" llama a window.print()', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(imprimir).toHaveBeenCalledTimes(1)
  })

  it('con print: se ocultan los controles, el aviso de pendientes enlaza sin enlace y todo pasa a negro sobre blanco', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(reporte({ pendientes_sin_cerrar: 2 }))
    montar()
    await esperarCarga()

    expect(screen.getByRole('group', { name: 'Día del reporte' }).parentElement).toHaveClass('print:hidden') // selector y botones
    expect(screen.getByRole('link', { name: 'Ver las citas de este día' })).toHaveClass('print:hidden')
    expect(screen.getByRole('heading', { level: 1, name: 'Reportes' })).toHaveClass('print:hidden')
    expect(screen.getByText('Black Iron Barbers · Reporte diario')).toHaveClass('hidden', 'print:block', 'text-black')

    const ingresos = within(screen.getByRole('heading', { name: 'Cifras del día' }).closest('section')).getByText('Ingresos')
    expect(ingresos.parentElement).toHaveClass('print:bg-white', 'print:border-zinc-400')
    expect(ingresos.nextSibling).toHaveClass('print:text-black')
    expect(screen.getByRole('table').closest('section')).toHaveClass('print:bg-white')
  })
})
