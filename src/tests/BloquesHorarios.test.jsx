import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PasoFechaHora from '../components/sections/reserva/PasoFechaHora'
import ResumenReserva from '../components/sections/reserva/ResumenReserva'
import ModalConfirmacion from '../components/sections/reserva/ModalConfirmacion'
import PantallaExito from '../components/sections/reserva/PantallaExito'
import {
  MENSAJE_BLOQUE_LLENO,
  estadoInicialReserva,
  reservaReducer,
} from '../components/sections/reserva/reservaReducer'
import { agruparHorasEnBloques, bloqueDeHora, generarBloques, primeraHoraLibre, textoHoraAsignada } from '../utils/bloquesHorarios'
import { obtenerDisponibilidad } from '../services/api'
import { hoyISO, sumarDiasISO } from '../utils/fechas'

vi.mock('../services/api', () => ({
  obtenerDisponibilidad: vi.fn(),
}))

const FECHA = sumarDiasISO(hoyISO(), 1)
const bloqueBoton = (inicio) => screen.findByRole('button', { name: new RegExp(`^${inicio}:00 – ${inicio + 1}:00`) })

const montar = (props = {}) =>
  render(
    <PasoFechaHora
      servicioIds={[1]}
      barberoId={null}
      fecha={FECHA}
      hora=""
      onSeleccionarFecha={vi.fn()}
      onSeleccionarHora={vi.fn()}
      {...props}
    />
  )

describe('utils/bloquesHorarios', () => {
  it('genera 10 bloques de 1 hora, de 10:00 – 11:00 a 19:00 – 20:00 (salen del horario de negocio)', () => {
    const bloques = generarBloques()
    expect(bloques).toHaveLength(10)
    expect(bloques[0].etiqueta).toBe('10:00 – 11:00')
    expect(bloques[9].etiqueta).toBe('19:00 – 20:00')
  })

  it('agrupa las horas: un bloque está disponible si tiene al menos una hora de inicio dentro', () => {
    const bloques = agruparHorasEnBloques(['10:30', '11:00', '11:30', '19:00'])
    expect(bloques.find((b) => b.clave === '10:00')).toMatchObject({ horas: ['10:30'], disponible: true })
    expect(bloques.find((b) => b.clave === '11:00')).toMatchObject({ horas: ['11:00', '11:30'], disponible: true })
    expect(bloques.find((b) => b.clave === '12:00')).toMatchObject({ horas: [], disponible: false })
    expect(bloques.find((b) => b.clave === '19:00')).toMatchObject({ horas: ['19:00'], disponible: true })
  })

  it('ignora horas fuera del horario y calcula el bloque de una hora exacta', () => {
    expect(agruparHorasEnBloques(['09:30', '20:00']).every((b) => !b.disponible)).toBe(true)
    expect(bloqueDeHora('10:30').corta).toBe('10–11')
    expect(bloqueDeHora('19:30').corta).toBe('19–20')
    expect(bloqueDeHora('09:30')).toBeUndefined()
  })

  it('primeraHoraLibre devuelve la primera, sin contar las excluidas, o null', () => {
    const [bloque] = agruparHorasEnBloques(['10:00', '10:30'])
    expect(primeraHoraLibre(bloque)).toBe('10:00')
    expect(primeraHoraLibre(bloque, ['10:00'])).toBe('10:30')
    expect(primeraHoraLibre(bloque, ['10:00', '10:30'])).toBeNull()
  })

  it('el texto de la hora asignada incluye bloque y hora exacta', () => {
    expect(textoHoraAsignada('10:30')).toBe('Bloque 10–11 · tu cita es a las 10:30')
    expect(textoHoraAsignada('10:30:00', 'tu asesoría')).toBe('Bloque 10–11 · tu asesoría es a las 10:30')
  })
})

describe('PasoFechaHora — bloques de 1 hora', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra los 10 bloques, con los sin horas deshabilitados y rotulados "Completa"', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30', '13:00'] })
    montar()

    const grupo = await screen.findByRole('group', { name: /horas disponibles/i })
    const botones = within(grupo).getAllByRole('button')
    expect(botones).toHaveLength(10)

    expect(await bloqueBoton(10)).not.toHaveAttribute('aria-disabled')
    expect(await bloqueBoton(13)).not.toHaveAttribute('aria-disabled')

    const completo = await bloqueBoton(11)
    expect(completo).toHaveAttribute('aria-disabled', 'true')
    expect(completo).toHaveTextContent('Completa') // el estado se dice con texto, no solo con color
    expect(within(grupo).getAllByText('Completa')).toHaveLength(8)
  })

  it('un bloque "Completa" no se puede elegir', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00'] })
    const user = userEvent.setup()
    const onSeleccionarHora = vi.fn()
    montar({ onSeleccionarHora })

    await user.click(await bloqueBoton(12))
    expect(onSeleccionarHora).not.toHaveBeenCalled()
  })

  it('al elegir un bloque asigna su PRIMERA hora libre (la exacta, no la del bloque)', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:30', '11:00', '11:30'] })
    const user = userEvent.setup()
    const onSeleccionarHora = vi.fn()
    montar({ onSeleccionarHora })

    await user.click(await bloqueBoton(10))
    expect(onSeleccionarHora).toHaveBeenLastCalledWith('10:30')
    await user.click(await bloqueBoton(11))
    expect(onSeleccionarHora).toHaveBeenLastCalledWith('11:00')
  })

  it('con una hora elegida marca su bloque (aria-pressed) y anuncia "Bloque 10–11 · tu cita es a las 10:30"', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:30', '11:00'] })
    montar({ hora: '10:30' })

    expect(await bloqueBoton(10)).toHaveAttribute('aria-pressed', 'true')
    expect(await bloqueBoton(11)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('status')).toHaveTextContent('Bloque 10–11 · tu cita es a las 10:30')
  })

  it('el último bloque (19–20) puede tener menos inicios que los demás', async () => {
    // Con un servicio de 45 min el último inicio es 19:00: el bloque 19–20 tiene una sola hora.
    obtenerDisponibilidad.mockResolvedValue({ horas: ['18:00', '18:30', '19:00'] })
    const user = userEvent.setup()
    const onSeleccionarHora = vi.fn()
    montar({ onSeleccionarHora })

    const ultimo = await bloqueBoton(19)
    expect(ultimo).not.toHaveAttribute('aria-disabled')
    await user.click(ultimo)
    expect(onSeleccionarHora).toHaveBeenCalledWith('19:00')
  })

  it('sin ninguna hora libre sigue el aviso de siempre', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: [] })
    montar()
    expect(await screen.findByText('No hay horas disponibles para esa fecha.')).toBeInTheDocument()
  })

  it('al recargar, una hora elegida que ya no existe se limpia', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['11:00'] })
    const onSeleccionarHora = vi.fn()
    montar({ hora: '10:30', onSeleccionarHora })

    await bloqueBoton(11)
    expect(onSeleccionarHora).toHaveBeenCalledWith('')
  })

  it('reintento tras un 409: asigna la siguiente hora libre del MISMO bloque (sin contar la ocupada)', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30', '11:00'] }) // la 10:00 aún figura: se excluye
    const onReasignarHora = vi.fn()
    montar({ horaOcupada: '10:00', onReasignarHora })

    await bloqueBoton(10)
    expect(onReasignarHora).toHaveBeenCalledTimes(1)
    expect(onReasignarHora).toHaveBeenCalledWith('10:30')
  })

  it('reintento tras un 409 con el bloque ya sin horas: avisa con null (no salta a otro bloque)', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['11:00', '11:30'] })
    const onReasignarHora = vi.fn()
    montar({ horaOcupada: '10:30', onReasignarHora })

    await bloqueBoton(11)
    expect(onReasignarHora).toHaveBeenCalledWith(null)
  })

  it('muestra el aviso de reasignación en el área role="status"', async () => {
    obtenerDisponibilidad.mockResolvedValue({ horas: ['10:30'] })
    montar({ hora: '10:30', avisoHora: 'La hora de las 10:00 se ocupó. Te asignamos las 10:30, del bloque 10–11.' })
    await bloqueBoton(10)
    expect(screen.getByRole('status')).toHaveTextContent('Te asignamos las 10:30')
  })
})

describe('reservaReducer — hora por bloques', () => {
  const enFechaHora = { ...estadoInicialReserva([1]), paso: 'confirmar', fecha: '2030-06-15', hora: '10:00' }

  it('HORA_OCUPADA recuerda la hora ocupada y REASIGNAR_HORA asigna la nueva con aviso', () => {
    const ocupada = reservaReducer(enFechaHora, { type: 'HORA_OCUPADA' })
    expect(ocupada).toMatchObject({ paso: 'fecha-hora', hora: '', horaOcupada: '10:00', errorGlobal: '' })

    const reasignada = reservaReducer(ocupada, { type: 'REASIGNAR_HORA', hora: '10:30' })
    expect(reasignada).toMatchObject({ hora: '10:30', horaOcupada: '', errorGlobal: '' })
    expect(reasignada.avisoHora).toContain('10:00')
    expect(reasignada.avisoHora).toContain('10:30')
  })

  it('REASIGNAR_HORA sin hora (bloque lleno) pide elegir otro bloque', () => {
    const ocupada = reservaReducer(enFechaHora, { type: 'HORA_OCUPADA' })
    const llena = reservaReducer(ocupada, { type: 'REASIGNAR_HORA', hora: null })
    expect(llena).toMatchObject({ hora: '', horaOcupada: '', avisoHora: '', errorGlobal: MENSAJE_BLOQUE_LLENO })
  })

  it('cambiar servicios, barbero, asesor o fecha limpia hora, aviso y reintento pendiente', () => {
    const conAviso = { ...enFechaHora, avisoHora: 'algo', horaOcupada: '10:00' }
    for (const accion of [
      { type: 'SELECCIONAR_SERVICIOS', servicioIds: [2] },
      { type: 'SELECCIONAR_BARBERO', barberoId: 3 },
      { type: 'SELECCIONAR_ASESOR', asesorId: 3 },
      { type: 'SELECCIONAR_FECHA', fecha: '2030-06-16' },
    ]) {
      const siguiente = reservaReducer(conAviso, accion)
      expect(siguiente.hora).toBe('')
      expect(siguiente.avisoHora).toBe('')
      expect(siguiente.horaOcupada).toBe('')
    }
  })
})

describe('hora exacta en resumen, modal y éxito', () => {
  const SERVICIO = { id: 1, nombre: 'Corte de Cabello', duracion_min: 30, precio: 55000 }
  const BARBERO = { id: 1, nombre: 'Boby' }

  it('ResumenReserva muestra "Bloque 10–11 · tu cita es a las 10:30"', () => {
    render(
      <ResumenReserva
        servicios={[SERVICIO]}
        barbero={BARBERO}
        mostrarBarbero
        fecha="2030-06-15"
        hora="10:30"
        onContinuar={vi.fn()}
        puedeContinuar
      />
    )
    expect(screen.getByText('Bloque 10–11 · tu cita es a las 10:30')).toBeInTheDocument()
  })

  it('ModalConfirmacion muestra el bloque y la hora exacta', () => {
    render(
      <ModalConfirmacion
        servicios={[SERVICIO]}
        barbero={BARBERO}
        fecha="2030-06-15"
        hora="10:30"
        onClose={vi.fn()}
        onConfirmar={vi.fn()}
      />
    )
    expect(screen.getByText('Bloque 10–11 · tu cita es a las 10:30')).toBeInTheDocument()
  })

  it('PantallaExito muestra el bloque y la hora exacta que devolvió el servidor', () => {
    render(
      <PantallaExito
        resumen={{
          id: 1,
          servicio_nombre: 'Corte de Cabello',
          barbero_nombre: 'Boby',
          fecha: '2030-06-15',
          hora: '10:30:00',
          duracion_min: 30,
          precio: 55000,
        }}
        onNuevaReserva={vi.fn()}
      />
    )
    expect(screen.getByText('Bloque 10–11 · tu cita es a las 10:30')).toBeInTheDocument()
  })

  it('en una reserva combinada se ve la hora exacta de CADA cita', () => {
    const asesoria = { id: 9, nombre: 'Asesoría', duracion_min: 30, precio: 60000, area: 'asesoria' }
    render(
      <ResumenReserva
        servicios={[asesoria, SERVICIO]}
        barbero={BARBERO}
        mostrarBarbero
        fecha="2030-06-15"
        hora="10:30"
        onContinuar={vi.fn()}
        puedeContinuar
      />
    )
    expect(screen.getByText('10–11')).toBeInTheDocument() // fila "Bloque"
    expect(screen.getByText('10:30 – 11:00')).toBeInTheDocument() // asesoría
    expect(screen.getByText('11:00 – 11:30')).toBeInTheDocument() // corte, justo al terminar
  })
})
