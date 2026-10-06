import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import TablaCitas from '../components/dashboard/TablaCitas'
import TarjetaCita from '../components/dashboard/TarjetaCita'
import AgendaHoy from '../components/panel/AgendaHoy'
import ListaMisCitas from '../components/panel/ListaMisCitas'
import SeccionPorConfirmar from '../components/panel/SeccionPorConfirmar'
import VentanaBienvenida from '../components/panel/VentanaBienvenida'
import GraficoServiciosTop from '../components/admin/GraficoServiciosTop'

const LARGO = 'Tratamiento reconstructivo de keratina premium antifrizz con asesoría de imagen incluida'

const SERVICIOS_COMBO = [
  { id: 1, nombre: 'Corte clásico', duracion_min: 30, precio: 20000 },
  { id: 2, nombre: LARGO, duracion_min: 90, precio: 60000 },
  { id: 3, nombre: 'Cejas', duracion_min: 20, precio: 5000 },
]

const base = {
  cliente: 'Cliente Uno',
  correo: 'uno@example.com',
  fecha: '2026-10-04',
  hora: '10:00:00',
  estado: 'pendiente',
  barbero_id: 1,
  barbero_nombre: 'Barbero Uno',
  por_confirmar: false,
}

const SIMPLE = {
  ...base,
  id: 1,
  servicio_id: 1,
  servicio_nombre: 'Corte clásico',
  servicios: [{ id: 1, nombre: 'Corte clásico', duracion_min: 30, precio: 40000 }],
  duracion_min: 30,
  precio: 40000,
}
const COMBO = {
  ...base,
  id: 2,
  cliente: 'Cliente Combo',
  servicio_id: 1,
  servicio_nombre: SERVICIOS_COMBO.map((s) => s.nombre).join(' + '),
  servicios: SERVICIOS_COMBO,
  duracion_min: 140,
  precio: 85000,
}
// Citas del back-end antiguo / sin `servicios`: deben seguir mostrándose
const SIN_LISTA = { ...SIMPLE, id: 3, servicios: undefined }

const barberos = [{ id: 1, nombre: 'Barbero Uno' }]
const nada = vi.fn()

describe('Admin: TablaCitas y TarjetaCita con combos', () => {
  it('tabla: el combo lista cada servicio con su duración; la cita de un servicio queda como siempre', () => {
    render(<TablaCitas citas={[SIMPLE, COMBO]} mostrarBarbero onReasignar={nada} barberosActivos={barberos} />)
    const tabla = screen.getByRole('table')

    const filaSimple = within(tabla).getByText('Cliente Uno').closest('tr')
    expect(within(filaSimple).getByText('Corte clásico')).toBeInTheDocument()
    expect(within(filaSimple).queryByRole('list')).not.toBeInTheDocument()

    const filaCombo = within(tabla).getByText('Cliente Combo').closest('tr')
    const lista = within(filaCombo).getByRole('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
    expect(within(lista).getByText(LARGO)).toHaveClass('wrap-anywhere', 'min-w-0')
    expect(within(lista).getByText('1 h 30 min')).toBeInTheDocument()
  })

  it('tarjeta: combo con lista y nombre largo que se ajusta; simple igual que antes; sin lista sigue funcionando', () => {
    const { unmount } = render(<TarjetaCita cita={COMBO} mostrarBarbero />)
    const lista = screen.getByRole('list', { name: '3 servicios' })
    expect(within(lista).getByText(LARGO)).toHaveClass('wrap-anywhere')
    expect(lista).toHaveClass('text-sm', 'text-gray-400')
    unmount()

    const simple = render(<TarjetaCita cita={SIMPLE} />)
    expect(screen.getByText('Corte clásico').tagName).toBe('P')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    simple.unmount()

    render(<TarjetaCita cita={SIN_LISTA} />)
    expect(screen.getByText('Corte clásico')).toBeInTheDocument()
  })
})

describe('Barbero: AgendaHoy', () => {
  const datos = { fecha: '2026-10-04', citas: [SIMPLE, COMBO] }
  const montar = () =>
    render(<AgendaHoy datos={datos} cargando={false} alReintentar={nada} alCompletar={nada} alCancelar={nada} />)

  it('un servicio: una sola línea "nombre · duración · precio" como siempre', () => {
    montar()
    expect(screen.getByText('Corte clásico · 30 min · $40.000')).toBeInTheDocument()
  })

  it('combo: lista de servicios con su duración, y la línea de total (duración total y precio)', () => {
    montar()
    const item = screen.getByText('Cliente Combo').closest('li')
    expect(within(item).getAllByRole('listitem')).toHaveLength(3)
    expect(within(item).getByText(LARGO)).toHaveClass('wrap-anywhere')
    expect(within(item).getByText('Total 140 min · $85.000')).toBeInTheDocument()
  })
})

describe('Barbero: Mis citas (tarjetas y tabla)', () => {
  it('tarjetas: combo con lista y total; simple como siempre', () => {
    render(<ListaMisCitas citas={[SIMPLE, COMBO]} tabla={false} alCompletar={nada} alCancelar={nada} />)
    expect(screen.getByText('Corte clásico · 30 min · $40.000')).toBeInTheDocument()
    const item = screen.getByText('Cliente Combo').closest('li')
    expect(within(item).getAllByRole('listitem')).toHaveLength(3)
    expect(within(item).getByText('Total 140 min · $85.000')).toBeInTheDocument()
  })

  it('tabla: la celda del combo lista los servicios y la columna Duración trae el TOTAL', () => {
    render(<ListaMisCitas citas={[SIMPLE, COMBO]} tabla alCompletar={nada} alCancelar={nada} />)
    const fila = screen.getByText('Cliente Combo').closest('tr')
    expect(within(fila).getAllByRole('listitem')).toHaveLength(3)
    expect(within(fila).getByText('140 min')).toBeInTheDocument()
    expect(within(fila).getByText('$85.000')).toBeInTheDocument()
    const simple = screen.getByText('Cliente Uno').closest('tr')
    expect(within(simple).queryByRole('list')).not.toBeInTheDocument()
    expect(within(simple).getByText('Corte clásico')).toBeInTheDocument()
  })
})

describe('Barbero: Por confirmar y ventana de bienvenida', () => {
  const porConfirmar = (items) => ({
    total: items.length,
    items: items.map((c) => ({ ...c, vencida_hace_min: 90, termino_hace_min: 210 })),
  })

  it('por confirmar: combo con lista, fecha/hora y duración total; simple como siempre', () => {
    render(
      <SeccionPorConfirmar
        datos={porConfirmar([SIMPLE, COMBO])}
        alReintentar={nada}
        alCompletar={nada}
        alCancelar={nada}
      />
    )
    expect(screen.getByText('Corte clásico · 04/10/2026 · 10:00')).toBeInTheDocument()
    const item = screen.getByText('Cliente Combo').closest('li')
    expect(within(item).getAllByRole('listitem')).toHaveLength(3)
    expect(within(item).getByText('04/10/2026 · 10:00 · Total 140 min')).toBeInTheDocument()
  })

  it('bienvenida: los nombres unidos del combo se muestran completos y ajustan línea', () => {
    render(
      <MemoryRouter>
        <VentanaBienvenida
          nombre="Leo"
          resumen={{
            fecha: '2026-10-04',
            citas_hoy: 1,
            proxima_cita: { id: 2, cliente: 'Cliente Combo', servicio_nombre: COMBO.servicio_nombre, servicios: SERVICIOS_COMBO, fecha: '2026-10-04', hora: '15:00:00' },
          }}
          porConfirmar={{ total: 1, items: [{ ...COMBO, fecha: '2026-10-03' }] }}
          alCerrar={nada}
        />
      </MemoryRouter>
    )
    const proxima = screen.getByText(/Tu próxima cita: Cliente Combo/)
    expect(proxima).toHaveTextContent(LARGO)
    expect(proxima).toHaveClass('wrap-anywhere')
    expect(screen.getByText(/Cliente Combo · Corte clásico \+/).closest('li')).toHaveClass('wrap-anywhere')
  })
})

describe('Admin: servicios más pedidos', () => {
  it('cuenta cada servicio (por línea) y deja el nombre completo disponible al recortarse', () => {
    const servicios = [
      { id: 1, nombre: LARGO, cantidad: 5, ingresos: 300000 },
      { id: 2, nombre: 'Corte clásico', cantidad: 3, ingresos: 60000 },
    ]
    const { container } = render(<GraficoServiciosTop servicios={servicios} />)
    expect(container.querySelector('svg title')?.textContent).toBe(LARGO)
    expect(screen.getByRole('img')).toHaveAccessibleName(/Corte clásico, 3 veces/)
  })
})
