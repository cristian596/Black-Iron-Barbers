import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResumenReserva from '../components/sections/reserva/ResumenReserva'
import ContenedorModal from './ContenedorModalPrueba'
import { prepararVerificacionMock, verificarCorreoEnModal } from './verificacionPrueba'
import PantallaExito from '../components/sections/reserva/PantallaExito'

vi.mock('../services/api', () => ({
  solicitarCodigoCorreo: vi.fn(),
  confirmarCodigoCorreo: vi.fn(),
  comprobarAsesoriaGratis: vi.fn(),
}))

beforeEach(() => prepararVerificacionMock())

const NOMBRE_LARGO = 'Tratamiento reconstructivo de keratina premium antifrizz con asesoría de imagen incluida'
const UNO = { id: 1, nombre: 'Corte clásico', duracion_min: 35, precio: 55000 }
const DOS = { id: 2, nombre: 'Perfilado de barba', duracion_min: 20, precio: 12000 }
const TRES = { id: 3, nombre: NOMBRE_LARGO, duracion_min: 90, precio: 60000 }
const BARBERO = { id: 1, nombre: 'Boby' }

const montarResumen = (servicios) =>
  render(
    <ResumenReserva
      servicios={servicios}
      barbero={BARBERO}
      mostrarBarbero
      fecha="2030-06-15"
      hora="10:00"
      onContinuar={vi.fn()}
      puedeContinuar
    />
  )
const resumenes = () => screen.getAllByLabelText(/resumen de la reserva/i) // [aside escritorio, barra móvil]

describe('ResumenReserva con 1, 2 y 3 servicios', () => {
  it('1 servicio: igual que siempre (fila "Servicio", sin duración total) y total del servicio', () => {
    montarResumen([UNO])
    const [aside, barra] = resumenes()

    expect(within(aside).getByText('Servicio')).toBeInTheDocument()
    expect(within(aside).queryByText('Servicios')).not.toBeInTheDocument()
    expect(within(aside).queryByText('Duración total')).not.toBeInTheDocument()
    expect(within(aside).getByText('$55.000')).toBeInTheDocument()
    expect(within(barra).getByText('Total')).toBeInTheDocument() // sin "· N servicios"
    expect(within(barra).getByText('$55.000')).toBeInTheDocument()
  })

  it('2 servicios: lista con la duración de cada uno, duración total y total (suma)', () => {
    montarResumen([UNO, DOS])
    const [aside, barra] = resumenes()

    const lista = within(aside).getByRole('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(within(lista).getByText('35 min')).toBeInTheDocument()
    expect(within(lista).getByText('20 min')).toBeInTheDocument()
    expect(within(aside).getByText('Duración total')).toBeInTheDocument()
    expect(within(aside).getByText('55 min')).toBeInTheDocument()
    expect(within(aside).getByText('$67.000')).toBeInTheDocument()
    expect(within(barra).getByText('Total · 2 servicios · 55 min')).toBeInTheDocument()
    expect(within(barra).getByText('$67.000')).toBeInTheDocument()
  })

  it('3 servicios con un nombre muy largo: el nombre se ajusta (no desborda) y los totales suman', () => {
    montarResumen([UNO, DOS, TRES])
    const [aside, barra] = resumenes()

    const nombre = within(aside).getByText(NOMBRE_LARGO)
    expect(nombre).toHaveClass('min-w-0', 'wrap-anywhere')
    expect(nombre.closest('li')).toHaveClass('flex', 'justify-between')
    expect(within(aside).getByText('2 h 25 min')).toBeInTheDocument() // 35 + 20 + 90
    expect(within(aside).getByText('$127.000')).toBeInTheDocument()
    expect(within(barra).getByText('Total · 3 servicios · 2 h 25 min')).toBeInTheDocument()
    // la barra móvil recorta su rótulo en vez de ensancharse
    expect(within(barra).getByText(/^Total · 3 servicios/)).toHaveClass('truncate')
  })

  it('1 servicio con nombre largo también se ajusta (fila Servicio)', () => {
    montarResumen([TRES])
    const [aside] = resumenes()
    expect(within(aside).getByText(NOMBRE_LARGO)).toHaveClass('wrap-anywhere', 'min-w-0')
  })

  it('sin servicios: invita a elegir y no muestra total', () => {
    montarResumen([])
    const [aside, barra] = resumenes()
    expect(within(aside).getByText('Elige un servicio para empezar.')).toBeInTheDocument()
    expect(within(barra).getByText('—')).toBeInTheDocument()
  })

  it('los botones "Continuar" miden al menos 44 px (min-h-11)', () => {
    montarResumen([UNO])
    screen.getAllByRole('button', { name: /^continuar$/i }).forEach((b) => expect(b).toHaveClass('min-h-11'))
  })

  it('la barra móvil sigue en z-40 y solo en pantallas pequeñas', () => {
    montarResumen([UNO, DOS])
    const barra = resumenes()[1]
    expect(barra).toHaveClass('fixed', 'bottom-0', 'z-40', 'lg:hidden')
  })
})

const montarModal = (servicios, props = {}) =>
  render(
    <ContenedorModal
      servicios={servicios}
      barbero={BARBERO}
      fecha="2030-06-15"
      hora="10:00"
      onClose={vi.fn()}
      onConfirmar={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  )

describe('ModalConfirmacion con 1, 2 y 3 servicios', () => {
  it('1 servicio: resumen de siempre ("35 min", total del servicio)', () => {
    montarModal([UNO])
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Servicio')).toBeInTheDocument()
    expect(within(modal).queryByText('Servicios')).not.toBeInTheDocument()
    expect(within(modal).getByText('35 min')).toBeInTheDocument()
    expect(within(modal).getByText('$55.000')).toBeInTheDocument()
  })

  it('2 servicios: cada uno con su duración y precio, duración total y total', () => {
    montarModal([UNO, DOS])
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Servicios')).toBeInTheDocument()
    expect(within(modal).getByText('35 min · $55.000')).toBeInTheDocument()
    expect(within(modal).getByText('20 min · $12.000')).toBeInTheDocument()
    expect(within(modal).getByText('55 min')).toBeInTheDocument()
    expect(within(modal).getByText('$67.000')).toBeInTheDocument()
  })

  it('3 servicios con nombre largo: ajusta el texto y suma el total', () => {
    montarModal([UNO, DOS, TRES])
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText(NOMBRE_LARGO)).toHaveClass('wrap-anywhere', 'min-w-0')
    expect(within(modal).getByText('2 h 25 min')).toBeInTheDocument()
    expect(within(modal).getByText('$127.000')).toBeInTheDocument()
  })

  it('sigue permitiendo confirmar (el formulario no cambia)', async () => {
    const user = userEvent.setup()
    const onConfirmar = vi.fn().mockResolvedValue(undefined)
    montarModal([UNO, DOS], { onConfirmar })
    await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
    await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
    await verificarCorreoEnModal(user) // MODIFICADO: ahora hay que verificar el correo antes de confirmar
    await user.type(screen.getByLabelText('Teléfono'), '3001234567')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ cliente: 'Juan Pérez', consentimiento: true }))
  })
})

const exito = (servicios, extra = {}) => ({
  id: 1,
  servicio_nombre: servicios.map((s) => s.nombre).join(' + '),
  servicios,
  barbero_nombre: 'Danny',
  fecha: '2030-06-15T05:00:00.000Z',
  hora: '10:00:00',
  duracion_min: servicios.reduce((n, s) => n + s.duracion_min, 0),
  precio: servicios.reduce((n, s) => n + s.precio, 0),
  ...extra,
})

describe('PantallaExito con 1, 2 y 3 servicios', () => {
  it('1 servicio: igual que siempre', () => {
    render(<PantallaExito resumen={exito([UNO])} onNuevaReserva={vi.fn()} />)
    expect(screen.getByText('Servicio')).toBeInTheDocument()
    expect(screen.queryByText('Servicios')).not.toBeInTheDocument()
    expect(screen.getByText('35 min')).toBeInTheDocument()
    expect(screen.getByText('$55.000')).toBeInTheDocument()
  })

  it('un resumen sin la lista `servicios` (formato anterior) se muestra como siempre', () => {
    render(
      <PantallaExito
        resumen={{ id: 1, servicio_nombre: 'Combo (Pelo + Barba)', barbero_nombre: 'Danny', fecha: '2030-06-15', hora: '10:00:00', duracion_min: 90, precio: 103000 }}
        onNuevaReserva={vi.fn()}
      />
    )
    expect(screen.getByText('Combo (Pelo + Barba)')).toBeInTheDocument()
    expect(screen.getByText('90 min')).toBeInTheDocument()
  })

  it('2 servicios: lista con duración y precio, duración total y total', () => {
    render(<PantallaExito resumen={exito([UNO, DOS])} onNuevaReserva={vi.fn()} />)
    expect(screen.getByText('Servicios')).toBeInTheDocument()
    expect(screen.getByText('35 min · $55.000')).toBeInTheDocument()
    expect(screen.getByText('20 min · $12.000')).toBeInTheDocument()
    expect(screen.getByText('55 min')).toBeInTheDocument()
    expect(screen.getByText('$67.000')).toBeInTheDocument()
  })

  it('3 servicios con nombre largo', () => {
    render(<PantallaExito resumen={exito([UNO, DOS, TRES])} onNuevaReserva={vi.fn()} />)
    expect(screen.getByText(NOMBRE_LARGO)).toHaveClass('wrap-anywhere', 'min-w-0')
    expect(screen.getByText('2 h 25 min')).toBeInTheDocument()
    expect(screen.getByText('$127.000')).toBeInTheDocument()
    expect(screen.getByText('Danny')).toBeInTheDocument()
  })
})
