import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ReservaCombinada, { EtiquetaArea } from '../components/ui/ReservaCombinada'
import AgendaHoy from '../components/panel/AgendaHoy'
import ListaMisCitas from '../components/panel/ListaMisCitas'
import SeccionPorConfirmar from '../components/panel/SeccionPorConfirmar'
import TablaCitas from '../components/dashboard/TablaCitas'
import TarjetaCita from '../components/dashboard/TarjetaCita'
import PanelServiciosTop from '../components/admin/PanelServiciosTop'
import PanelIndicadores from '../components/admin/PanelIndicadores'
import { indicadoresBarbero } from '../data/indicadoresBarbero'
import GraficoIngresos from '../components/admin/GraficoIngresos'
import Citas from '../pages/admin/Citas'
import Reportes from '../pages/admin/Reportes'
import { profesionalesDeArea, textoArea } from '../utils/areas'
import * as api from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { usuario: 'admin', rol: 'admin' } }),
}))

// Fase 6: paneles y estadísticas con asesorías. Etiquetas de área y de reserva combinada con el contexto de la otra cita,
// filtro por área y selector de reasignación por área en /admin/citas, serviciosTop por área, ingresos con desglose y
// reporte diario con asesorías.

const HERMANA_CORTE = {
  id: 902, area: 'barberia', profesional: 'Boby', hora_inicio: '11:00:00', hora_fin: '11:30:00', estado: 'pendiente',
}
const HERMANA_ASESORIA = {
  id: 901, area: 'asesoria', profesional: 'Camila', hora_inicio: '10:00:00', hora_fin: '11:00:00', estado: 'pendiente',
}

const base = {
  cliente: 'Ana Gómez',
  correo: 'ana@example.com',
  fecha: '2026-10-04',
  hora: '10:00:00',
  estado: 'pendiente',
  por_confirmar: false,
  vencida_hace_min: 30,
  duracion_min: 60,
  precio: 60000,
  reserva_id: null,
  hermana: null,
}
const ASESORIA_COMBINADA = {
  ...base, id: 901, area: 'asesoria', barbero_id: 9, barbero_nombre: 'Camila', servicio_id: 270,
  servicio_nombre: 'Asesoría Premium', servicios: [{ id: 270, nombre: 'Asesoría Premium', duracion_min: 60, precio: 60000 }],
  reserva_id: 'r-1', hermana: HERMANA_CORTE,
}
const CORTE_COMBINADO = {
  ...base, id: 902, area: 'barberia', barbero_id: 1, barbero_nombre: 'Boby', hora: '11:00:00', duracion_min: 30, precio: 20000,
  servicio_id: 1, servicio_nombre: 'Corte clásico', servicios: [{ id: 1, nombre: 'Corte clásico', duracion_min: 30, precio: 20000 }],
  reserva_id: 'r-1', hermana: HERMANA_ASESORIA,
}
const CORTE_SUELTO = {
  ...CORTE_COMBINADO, id: 903, cliente: 'Luis Suelto', reserva_id: null, hermana: null,
}
const nada = vi.fn()

describe('ReservaCombinada y EtiquetaArea', () => {
  it('una cita de reserva combinada muestra la etiqueta "Reserva combinada" y el contexto de la otra cita (área, con quién, horas y estado)', () => {
    render(<ReservaCombinada cita={ASESORIA_COMBINADA} />)
    expect(screen.getByText('Reserva combinada')).toBeInTheDocument()
    expect(screen.getByText(/Su otra cita: Barbería con Boby, de 11:00 a\s+11:30/)).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('desde el corte, la otra cita es la asesoría; una hermana cancelada muestra su estado', () => {
    const { rerender } = render(<ReservaCombinada cita={CORTE_COMBINADO} />)
    expect(screen.getByText(/Su otra cita: Asesoría con Camila, de 10:00 a\s+11:00/)).toBeInTheDocument()
    rerender(<ReservaCombinada cita={{ ...CORTE_COMBINADO, hermana: { ...HERMANA_ASESORIA, estado: 'cancelada' } }} />)
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
  })

  it('no enlaza a nada (la otra cita es de otro profesional) y no muestra más que los datos mínimos', () => {
    const { container } = render(<ReservaCombinada cita={ASESORIA_COMBINADA} />)
    expect(container.querySelector('a, button')).toBeNull()
    expect(container.textContent).not.toMatch(/ana@example|ana gómez|\$|#902/i)
  })

  it('una cita suelta (sin hermana) o de una respuesta anterior no pinta nada', () => {
    const { container, rerender } = render(<ReservaCombinada cita={CORTE_SUELTO} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ReservaCombinada cita={{ id: 1 }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('EtiquetaArea: "Barbería" / "Asesoría"; sin área no pinta nada', () => {
    const { container, rerender } = render(<EtiquetaArea area="barberia" />)
    expect(container).toHaveTextContent('Barbería')
    rerender(<EtiquetaArea area="asesoria" />)
    expect(container).toHaveTextContent('Asesoría')
    rerender(<EtiquetaArea />)
    expect(container).toBeEmptyDOMElement()
  })

  it('utilidades: textoArea y profesionalesDeArea (sin área = barbería)', () => {
    const personal = [{ id: 1, area: 'barberia' }, { id: 2 }, { id: 9, area: 'asesoria' }]
    expect(textoArea('asesoria')).toBe('Asesoría')
    expect(textoArea(undefined)).toBe('Barbería')
    expect(profesionalesDeArea(personal, 'asesoria').map((p) => p.id)).toEqual([9])
    expect(profesionalesDeArea(personal, 'barberia').map((p) => p.id)).toEqual([1, 2])
    expect(profesionalesDeArea(personal, undefined).map((p) => p.id)).toEqual([1, 2])
    expect(profesionalesDeArea(undefined, 'asesoria')).toBeUndefined()
  })
})

describe('Panel del profesional: la reserva combinada se ve en todas las listas', () => {
  it('agenda de hoy', () => {
    render(<AgendaHoy datos={{ fecha: '2026-10-04', citas: [ASESORIA_COMBINADA, CORTE_SUELTO] }} alReintentar={nada} alCompletar={nada} alCancelar={nada} />)
    const combinada = screen.getByText('Ana Gómez').closest('li')
    expect(within(combinada).getByText('Reserva combinada')).toBeInTheDocument()
    expect(within(combinada).getByText(/Su otra cita: Barbería con Boby/)).toBeInTheDocument()
    expect(within(screen.getByText('Luis Suelto').closest('li')).queryByText('Reserva combinada')).toBeNull()
  })

  it('mis citas: tarjetas y tabla', () => {
    const { unmount } = render(<ListaMisCitas citas={[CORTE_COMBINADO, CORTE_SUELTO]} tabla={false} alCompletar={nada} alCancelar={nada} />)
    expect(within(screen.getByText('Ana Gómez').closest('li')).getByText(/Su otra cita: Asesoría con Camila/)).toBeInTheDocument()
    expect(screen.getAllByText('Reserva combinada')).toHaveLength(1)
    unmount()
    render(<ListaMisCitas citas={[CORTE_COMBINADO, CORTE_SUELTO]} tabla alCompletar={nada} alCancelar={nada} />)
    expect(within(screen.getByText('Ana Gómez').closest('tr')).getByText(/Su otra cita: Asesoría con Camila/)).toBeInTheDocument()
    expect(screen.getAllByText('Reserva combinada')).toHaveLength(1)
  })

  it('por confirmar', () => {
    render(<SeccionPorConfirmar datos={{ total: 1, items: [ASESORIA_COMBINADA] }} alReintentar={nada} alCompletar={nada} alCancelar={nada} />)
    expect(screen.getByText('Reserva combinada')).toBeInTheDocument()
    expect(screen.getByText(/Su otra cita: Barbería con Boby/)).toBeInTheDocument()
  })
})

describe('Admin: TablaCitas y TarjetaCita', () => {
  const personal = [
    { id: 1, nombre: 'Boby', area: 'barberia' },
    { id: 2, nombre: 'Dani', area: 'barberia' },
    { id: 9, nombre: 'Camila', area: 'asesoria' },
    { id: 10, nombre: 'Asesor Dos', area: 'asesoria' },
  ]
  const opciones = (select) => within(select).getAllByRole('option').map((o) => o.textContent)

  it('tabla: etiqueta de área por cita y la reserva combinada con su hermana', () => {
    render(<TablaCitas citas={[ASESORIA_COMBINADA, CORTE_SUELTO]} mostrarBarbero onReasignar={nada} barberosActivos={personal} />)
    const tabla = screen.getByRole('table')
    expect(within(tabla).getByRole('columnheader', { name: 'Área' })).toBeInTheDocument()
    const fila = within(tabla).getByText('Ana Gómez').closest('tr')
    expect(within(fila).getByText('Asesoría')).toBeInTheDocument()
    expect(within(fila).getByText('Reserva combinada')).toBeInTheDocument()
    expect(within(within(tabla).getByText('Luis Suelto').closest('tr')).getByText('Barbería')).toBeInTheDocument()
  })

  it('tabla: el selector de reasignar ofrece SOLO asesores para una asesoría y SOLO barberos para un corte', () => {
    render(<TablaCitas citas={[ASESORIA_COMBINADA, CORTE_SUELTO]} mostrarBarbero onReasignar={nada} barberosActivos={personal} />)
    const deAsesoria = screen.getAllByLabelText('Reasignar asesor/a de la cita de Ana Gómez')[0]
    expect(opciones(deAsesoria)).toEqual(['Camila', 'Asesor Dos'])
    const deCorte = screen.getAllByLabelText('Reasignar barbero de la cita de Luis Suelto')[0]
    expect(opciones(deCorte)).toEqual(['Boby', 'Dani'])
  })

  it('tarjeta (móvil): área, reserva combinada y selector por área', () => {
    render(<TarjetaCita cita={ASESORIA_COMBINADA} mostrarBarbero onReasignar={nada} barberosActivos={personal} />)
    expect(screen.getByText('Asesoría')).toBeInTheDocument()
    expect(screen.getByText('Reserva combinada')).toBeInTheDocument()
    expect(screen.getByText('Asesor/a: Camila')).toBeInTheDocument()
    expect(opciones(screen.getByLabelText('Reasignar asesor/a de la cita de Ana Gómez'))).toEqual(['Camila', 'Asesor Dos'])
  })

  it('una cita de una respuesta anterior (sin área) se trata como barbería y no rompe', () => {
    const vieja = { ...CORTE_SUELTO, area: undefined }
    render(<TarjetaCita cita={vieja} onReasignar={nada} barberosActivos={personal} />)
    expect(opciones(screen.getByLabelText('Reasignar barbero de la cita de Luis Suelto'))).toEqual(['Boby', 'Dani'])
  })
})

describe('/admin/citas: filtro por área', () => {
  const Ubicacion = () => <output data-testid="ubicacion">{useLocation().search}</output>
  const montar = (ruta = '/admin/citas') => {
    const router = createMemoryRouter(
      [{ path: '/admin/citas', element: (<><Citas /><Ubicacion /></>) }],
      { initialEntries: [ruta] }
    )
    render(<RouterProvider router={router} />)
  }
  const ultima = () => vi.mocked(api.obtenerCitasAdmin).mock.calls.at(-1)[1]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.obtenerCitasAdmin).mockResolvedValue({ items: [ASESORIA_COMBINADA, CORTE_COMBINADO], total: 2, pagina: 1, limite: 15 })
    vi.mocked(api.obtenerBarberos).mockResolvedValue([
      { id: 1, nombre: 'Boby', area: 'barberia' },
      { id: 9, nombre: 'Camila', area: 'asesoria' },
    ])
  })

  it('sin filtro de área no manda area; el selector ofrece Todas / Barbería / Asesoría', async () => {
    montar()
    await screen.findByText('Reserva combinada', {}, { timeout: 3000 }).catch(() => screen.findAllByText('Reserva combinada'))
    expect(ultima()).not.toHaveProperty('area')
    const selector = screen.getByLabelText('Área')
    expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas las áreas', 'Barbería', 'Asesoría'])
    expect(selector).toHaveValue('')
  })

  it('elegir "Asesoría" lo pide al servidor y lo deja en la URL; "Limpiar filtros" lo quita', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findAllByText('Reserva combinada')
    await user.selectOptions(screen.getByLabelText('Área'), 'asesoria')
    await waitFor(() => expect(ultima()).toMatchObject({ area: 'asesoria', pagina: 1 }))
    expect(screen.getByTestId('ubicacion').textContent).toBe('?area=asesoria')
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(ultima()).not.toHaveProperty('area'))
    expect(screen.getByTestId('ubicacion').textContent).toBe('')
  })

  it('llegar con ?area=barberia lo respeta; un valor inválido se ignora', async () => {
    montar('/admin/citas?area=barberia')
    await screen.findAllByText('Reserva combinada')
    expect(ultima()).toMatchObject({ area: 'barberia' })
    expect(screen.getByLabelText('Área')).toHaveValue('barberia')
  })

  it('un ?area= inválido se ignora', async () => {
    montar('/admin/citas?area=otra')
    await screen.findAllByText('Reserva combinada')
    expect(ultima()).not.toHaveProperty('area')
    expect(screen.getByLabelText('Área')).toHaveValue('')
  })

  it('muestra el área y la reserva combinada de cada cita, y el selector de reasignar por área (con Camila para la asesoría)', async () => {
    montar()
    await screen.findAllByText('Reserva combinada')
    const opciones = (select) => within(select).getAllByRole('option').map((o) => o.textContent)
    expect(screen.getAllByText('Asesoría').length).toBeGreaterThan(0)
    expect(opciones(screen.getAllByLabelText(/Reasignar asesor\/a de la cita de Ana Gómez/)[0])).toEqual(['Camila'])
    expect(opciones(screen.getAllByLabelText(/Reasignar barbero de la cita de Ana Gómez/)[0])).toEqual(['Boby'])
  })

  it('reasignar una asesoría manda el id del asesor elegido', async () => {
    const user = userEvent.setup()
    vi.mocked(api.obtenerBarberos).mockResolvedValue([
      { id: 1, nombre: 'Boby', area: 'barberia' },
      { id: 9, nombre: 'Camila', area: 'asesoria' },
      { id: 10, nombre: 'Asesor Dos', area: 'asesoria' },
    ])
    vi.mocked(api.actualizarCita).mockResolvedValue({})
    montar()
    await screen.findAllByText('Reserva combinada')
    await waitFor(() => expect(screen.getAllByLabelText(/Reasignar asesor\/a de la cita de Ana Gómez/)[0].querySelectorAll('option')).toHaveLength(2))
    await user.selectOptions(screen.getAllByLabelText(/Reasignar asesor\/a de la cita de Ana Gómez/)[0], '10')
    expect(api.actualizarCita).toHaveBeenCalledWith('tok', 901, { barbero_id: 10 })
  })
})

describe('Servicios más pedidos: selector Barbería / Asesorías', () => {
  const periodo = { clave: 'hoy', desde: '2026-10-04', hasta: '2026-10-04' }
  const respuesta = (area, servicios) => ({ periodo, area, servicios })
  let obtener
  beforeEach(() => {
    obtener = vi.fn(async (_t, _p, _l, area = 'barberia') =>
      area === 'asesoria'
        ? respuesta('asesoria', [{ id: 270, nombre: 'Asesoría Premium', cantidad: 3, ingresos: 180000 }])
        : respuesta('barberia', [{ id: 1, nombre: 'Corte clásico', cantidad: 5, ingresos: 100000 }])
    )
  })

  it('barbería por defecto; "Asesorías" pide area=asesoria y no mezcla las listas', async () => {
    const user = userEvent.setup()
    render(<PanelServiciosTop token="tok" periodo="hoy" obtener={obtener} conSelectorArea />)
    await screen.findAllByText('Corte clásico')
    expect(obtener).toHaveBeenLastCalledWith('tok', 'hoy', 5, 'barberia')
    const grupo = screen.getByRole('group', { name: 'Área de los servicios' })
    expect(within(grupo).getByRole('button', { name: 'Barbería' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(grupo).getByRole('button', { name: 'Asesorías' }))
    await screen.findAllByText('Asesoría Premium')
    expect(obtener).toHaveBeenLastCalledWith('tok', 'hoy', 5, 'asesoria')
    expect(screen.queryAllByText('Corte clásico')).toHaveLength(0)
    expect(within(grupo).getByRole('button', { name: 'Asesorías' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupo).getByRole('button', { name: 'Barbería' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('los botones miden al menos 44 px de alto (min-h-11)', async () => {
    render(<PanelServiciosTop token="tok" periodo="hoy" obtener={obtener} conSelectorArea />)
    await screen.findAllByText('Corte clásico')
    for (const boton of within(screen.getByRole('group', { name: 'Área de los servicios' })).getAllByRole('button')) {
      expect(boton).toHaveClass('min-h-11')
    }
  })

  it('vacío por área y error con Reintentar', async () => {
    const user = userEvent.setup()
    obtener.mockImplementation(async (_t, _p, _l, area) => respuesta(area, []))
    render(<PanelServiciosTop token="tok" periodo="hoy" obtener={obtener} conSelectorArea />)
    expect(await screen.findByText('Aún no hay servicios completados en este período.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Asesorías' }))
    expect(await screen.findByText('Aún no hay asesorías completadas en este período.')).toBeInTheDocument()

    obtener.mockRejectedValue(new Error('caído'))
    await user.click(screen.getByRole('button', { name: 'Barbería' }))
    expect(await screen.findByText('No pudimos cargar los servicios.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })

  it('sin selector (panel del barbero) no hay botones de área y se pide como siempre', async () => {
    render(<PanelServiciosTop token="tok" periodo="hoy" obtener={obtener} />)
    await screen.findAllByText('Corte clásico')
    expect(screen.queryByRole('group', { name: 'Área de los servicios' })).toBeNull()
    expect(obtener).toHaveBeenLastCalledWith('tok', 'hoy', 5)
  })
})

describe('Ingresos con desglose por área', () => {
  const punto = (fecha, ingresos, barberia, asesoria, cortes, asesorias) => ({
    fecha, ingresos, ingresos_barberia: barberia, ingresos_asesoria: asesoria, cortes, asesorias, completadas: cortes + asesorias,
  })
  const puntos = [punto('2026-10-03', 100000, 40000, 60000, 2, 1), punto('2026-10-04', 0, 0, 0, 0, 0)]
  const anteriores = [punto('2026-10-01', 50000, 50000, 0, 2, 0), punto('2026-10-02', 0, 0, 0, 0, 0)]

  beforeEach(() => {
    // useAnchoElemento necesita un ancho; jsdom no mide
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
  })
  afterEach(() => vi.restoreAllMocks())

  it('con desglose: totales por área a la vista, resumen accesible y tabla con una columna por área', () => {
    const { container } = render(<GraficoIngresos agrupar="dia" puntos={puntos} anteriores={anteriores} desglose />)
    expect(screen.getByText(/Del período actual: barbería \$40\.000 · asesorías \$60\.000/)).toBeInTheDocument()
    expect(container.querySelector('svg').getAttribute('aria-label')).toMatch(/De barbería \$40\.000 y de asesorías \$60\.000/)
    const tabla = screen.getByRole('table', { hidden: true })
    expect(within(tabla).getAllByRole('columnheader', { hidden: true }).map((c) => c.textContent)).toEqual([
      'Día', 'Ingresos', 'Ingresos de barbería', 'Ingresos de asesorías', 'Cortes', 'Asesorías', 'Ingresos del período anterior',
    ])
    const fila = within(tabla).getAllByRole('row', { hidden: true })[1]
    expect([...fila.children].map((c) => c.textContent).slice(1, 6)).toEqual(['$100.000', '$40.000', '$60.000', '2', '1'])
    expect(screen.getByRole('button', { name: /barbería \$40\.000, asesorías \$60\.000\), 2 cortes y 1 asesoría/ })).toBeInTheDocument()
  })

  it('con desglose, el detalle al enfocar muestra Barbería y Asesorías por separado', () => {
    render(<GraficoIngresos agrupar="dia" puntos={puntos} anteriores={anteriores} desglose />)
    fireEvent.focus(screen.getAllByRole('button')[0])
    expect(screen.getByText('Barbería $40.000')).toBeInTheDocument()
    expect(screen.getByText('Asesorías $60.000')).toBeInTheDocument()
  })

  it('sin desglose (panel del profesional) cuenta las citas completadas con su vocabulario, también las de asesoría', () => {
    const soloAsesorias = [{ fecha: '2026-10-03', ingresos: 60000, cortes: 0, asesorias: 2, completadas: 2 }, { fecha: '2026-10-04', ingresos: 0, cortes: 0, asesorias: 0, completadas: 0 }]
    render(
      <GraficoIngresos
        agrupar="dia"
        puntos={soloAsesorias}
        anteriores={anteriores}
        vocabulario={{ unidad: 'asesoría', unidades: 'asesorías', etiquetaTotal: 'Asesorías' }}
      />
    )
    expect(screen.getByRole('button', { name: /\$60\.000, 2 asesorías/ })).toBeInTheDocument()
    expect(screen.queryByText(/Del período actual/)).toBeNull()
  })
})

describe('Panel de quien atiende asesorías: su tarjeta cuenta sus asesorías, no los cortes de antes', () => {
  const periodo = { clave: 'mes', desde: '2026-10-01', hasta: '2026-10-08' }
  const estadisticas = (actual) => ({ periodo, anterior: periodo, actual, previo: actual })

  it('con asesorías: la tarjeta "Asesorías" usa el campo asesorias (no completadas, que incluiría un corte anterior)', async () => {
    const obtener = vi.fn(async () => estadisticas({ citas: 5, completadas: 5, cortes: 2, asesorias: 3, canceladas: 0, ingresos: 200000, ticket_promedio: 40000 }))
    render(<PanelIndicadores token="tok" periodo="mes" obtener={obtener} indicadores={indicadoresBarbero('asesoria')} mensajeVacio="No tienes asesorías completadas en este período." />)
    await screen.findByText('Ingresos')
    expect(indicadoresBarbero('asesoria')[0]).toMatchObject({ clave: 'asesorias', etiqueta: 'Asesorías' })
    expect(within(screen.getByText('Asesorías').closest('div')).getByText('3')).toBeInTheDocument()
  })

  it('solo con cortes de antes: la tarjeta marca 0 y aparece el mensaje de vacío', async () => {
    const obtener = vi.fn(async () => estadisticas({ citas: 2, completadas: 2, cortes: 2, asesorias: 0, canceladas: 0, ingresos: 36000, ticket_promedio: 18000 }))
    render(<PanelIndicadores token="tok" periodo="mes" obtener={obtener} indicadores={indicadoresBarbero('asesoria')} mensajeVacio="No tienes asesorías completadas en este período." />)
    expect(await screen.findByText('No tienes asesorías completadas en este período.')).toBeInTheDocument()
    expect(within(screen.getByText('Asesorías').closest('div')).getByText('0')).toBeInTheDocument()
  })

  it('el barbero sigue viendo sus cortes, y una respuesta sin desglose cae a completadas', async () => {
    expect(indicadoresBarbero('barberia')[0]).toMatchObject({ clave: 'cortes', respaldo: 'completadas', etiqueta: 'Cortes' })
    const obtener = vi.fn(async () => estadisticas({ citas: 4, completadas: 4, canceladas: 0, ingresos: 100000, ticket_promedio: 25000 }))
    render(<PanelIndicadores token="tok" periodo="mes" obtener={obtener} indicadores={indicadoresBarbero('barberia')} />)
    await screen.findByText('Ingresos')
    expect(within(screen.getByText('Cortes').closest('div')).getByText('4')).toBeInTheDocument()
  })
})

describe('Reportes: cortes y asesorías separados', () => {
  const reporte = (extra = {}) => ({
    fecha: '2026-10-04',
    total_cortes: 3,
    total_asesorias: 2,
    ingresos: 215000,
    ingresos_barberia: 95000,
    ingresos_asesoria: 120000,
    ticket_promedio: 31667,
    canceladas: 1,
    pendientes_sin_cerrar: 0,
    servicios_mas_pedidos: [{ nombre: 'Corte clásico', cantidad: 3, ingresos: 95000 }],
    asesorias_mas_pedidas: [{ nombre: 'Asesoría Premium', cantidad: 2, ingresos: 120000 }],
    ...extra,
  })
  const montar = () =>
    render(
      <MemoryRouter initialEntries={['/admin/reportes?fecha=2026-10-04']}>
        <Reportes />
      </MemoryRouter>
    )
  const esperar = () => screen.findByRole('heading', { name: 'Cifras del día' })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(reporte())
  })

  it('tarjetas separadas: total de cortes, total de asesorías, ingresos con desglose y ticket "de barbería"', async () => {
    montar()
    const cifras = within((await esperar()).closest('section'))
    expect(cifras.getByText('Total de cortes').nextSibling).toHaveTextContent('3')
    expect(cifras.getByText('Total de asesorías').nextSibling).toHaveTextContent('2')
    expect(cifras.getByText('Ingresos').nextSibling).toHaveTextContent('$215.000')
    expect(cifras.getByText('Barbería $95.000 · Asesorías $120.000')).toBeInTheDocument()
    expect(cifras.getByText('Ticket promedio de barbería').nextSibling).toHaveTextContent('$31.667')
  })

  it('las asesorías más pedidas van en su propia tabla, con cantidad e ingresos', async () => {
    montar()
    await esperar()
    const tabla = screen.getByRole('table', { name: /Asesorías completadas el .* de más a menos pedidas/ })
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Asesoría', 'Cantidad', 'Ingresos'])
    expect([...within(tabla).getAllByRole('row')[1].children].map((c) => c.textContent)).toEqual(['Asesoría Premium', '2', '$120.000'])
  })

  it('sin asesorías ese día lo dice; un día solo con asesorías NO se considera vacío', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(
      reporte({ total_cortes: 0, canceladas: 0, ingresos: 120000, ingresos_barberia: 0, servicios_mas_pedidos: [] })
    )
    montar()
    await esperar()
    expect(screen.getByText('Ningún corte completado este día.')).toBeInTheDocument()
    expect(screen.queryByText('No hay citas registradas en este día.')).toBeNull()

    vi.mocked(api.obtenerReporteDiario).mockResolvedValue(reporte({ asesorias_mas_pedidas: [], total_asesorias: 0 }))
    const { unmount } = montar()
    unmount()
    montar()
    expect(await screen.findAllByText('Ninguna asesoría completada este día.')).not.toHaveLength(0)
  })

  it('un reporte de una respuesta anterior (sin campos de asesoría) se sigue viendo', async () => {
    vi.mocked(api.obtenerReporteDiario).mockResolvedValue({
      fecha: '2026-10-04', total_cortes: 3, ingresos: 95000, ticket_promedio: 31667, canceladas: 0, pendientes_sin_cerrar: 0,
      servicios_mas_pedidos: [{ nombre: 'Corte clásico', cantidad: 3, ingresos: 95000 }],
    })
    montar()
    const cifras = within((await esperar()).closest('section'))
    expect(cifras.getByText('Total de asesorías').nextSibling).toHaveTextContent('0')
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })
})
