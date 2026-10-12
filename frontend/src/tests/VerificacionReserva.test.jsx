import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ReservaCorte from '../pages/ReservaCorte'
import { ProveedorCarrito } from '../context/CarritoContext'
import { useVerificacionCorreo } from '../hooks/useVerificacionCorreo'
import { esCorreoValido, normalizarCorreo } from '../utils/correo'
import {
  obtenerServicios,
  obtenerBarberos,
  obtenerDisponibilidad,
  crearCita,
  solicitarCodigoCorreo,
  confirmarCodigoCorreo,
} from '../services/api'
import { CODIGO_PRUEBA, TOKEN_PRUEBA, prepararVerificacionMock, verificarCorreoEnModal } from './verificacionPrueba'

vi.mock('../services/api', () => ({
  obtenerServicios: vi.fn(),
  obtenerServiciosAsesoria: vi.fn().mockResolvedValue([]),
  obtenerBarberos: vi.fn(),
  obtenerDisponibilidad: vi.fn(),
  crearCita: vi.fn(),
  solicitarCodigoCorreo: vi.fn(),
  confirmarCodigoCorreo: vi.fn(),
}))

// Verificación del correo dentro del flujo de reserva completo (ReservaCorte): el comprobante vive en la página, viaja
// como verificacion_token y sobrevive a un 409 de horario.

const SERVICIOS = [
  {
    id: 1,
    nombre: 'Corte Clasico',
    descripcion: 'Corte tradicional con acabado limpio',
    tipo: 'original',
    duracion_min: 35,
    precio: 55000,
    categoria: { id: 1, nombre: 'Cortes', slug: 'cortes' },
  },
]
const BARBEROS = [{ id: 1, nombre: 'Boby', especialidad: 'Fade y Barba' }]
const CITA = {
  id: 7,
  servicio_nombre: 'Corte Clasico',
  servicios: [{ id: 1, nombre: 'Corte Clasico', duracion_min: 35, precio: 55000 }],
  barbero_nombre: 'Boby',
  correo: 'juan@example.com',
  fecha: '2030-06-15',
  hora: '10:00:00',
  duracion_min: 35,
  precio: 55000,
  estado: 'pendiente',
}

const botonesContinuar = () => screen.getAllByRole('button', { name: /^continuar$/i })
const clickContinuar = async (user) => user.click(botonesContinuar()[0])

const llegarAlModal = async (user) => {
  await screen.findByRole('button', { name: /corte clasico/i })
  await clickContinuar(user)
  await screen.findByRole('heading', { name: /cualquier barbero/i })
  await clickContinuar(user)
  const grupoFechas = await screen.findByRole('group', { name: /fechas disponibles/i })
  await user.click(within(grupoFechas).getAllByRole('button')[0])
  await user.click(await screen.findByRole('button', { name: /^10:00 – 11:00/ }))
  await clickContinuar(user)
  await screen.findByRole('dialog')
}

const llenarTodoMenosVerificar = async (user, correo = 'juan@example.com') => {
  await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
  await user.type(screen.getByLabelText('Correo electrónico'), correo)
  await user.type(screen.getByLabelText('Teléfono'), '3001234567')
  await user.click(screen.getByRole('checkbox'))
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/reservar-corte?servicio=1']}>
      <ProveedorCarrito>
        <ReservaCorte />
      </ProveedorCarrito>
    </MemoryRouter>
  )

const confirmarBoton = () => screen.getByRole('button', { name: /confirmar reserva/i })

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-09T09:00:00-05:00'))
  prepararVerificacionMock()
  obtenerServicios.mockResolvedValue(SERVICIOS)
  obtenerBarberos.mockResolvedValue(BARBEROS)
  obtenerDisponibilidad.mockResolvedValue({ horas: ['10:00', '10:30'] })
})
afterEach(() => vi.useRealTimers())

describe('Verificación del correo en la reserva', () => {
  it('"Confirmar reserva" está deshabilitado hasta verificar, aunque todo lo demás esté lleno', async () => {
    const user = userEvent.setup()
    montar()
    await llegarAlModal(user)
    await llenarTodoMenosVerificar(user)

    expect(confirmarBoton()).toBeDisabled()
    await user.click(confirmarBoton())
    expect(crearCita).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    await user.type(await screen.findByLabelText('Código de verificación'), CODIGO_PRUEBA)
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    await screen.findByText('Correo verificado')
    expect(confirmarBoton()).not.toBeDisabled()
  })

  it('flujo feliz: el comprobante viaja como verificacion_token y la pantalla de éxito dice a qué correo se envió', async () => {
    const user = userEvent.setup()
    crearCita.mockResolvedValueOnce(CITA)
    montar()
    await llegarAlModal(user)
    await llenarTodoMenosVerificar(user)
    await verificarCorreoEnModal(user)
    await user.click(confirmarBoton())

    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(crearCita).toHaveBeenCalledWith(expect.objectContaining({ correo: 'juan@example.com', verificacion_token: TOKEN_PRUEBA }))
    expect(screen.getByText(/Te enviamos la confirmación a/)).toHaveTextContent('Te enviamos la confirmación a juan@example.com.')
    // Ni el código ni el comprobante aparecen en pantalla.
    expect(document.body.innerHTML).not.toContain(TOKEN_PRUEBA)
  })

  it('el comprobante solo vive en memoria: no se guarda en localStorage ni sessionStorage', async () => {
    const user = userEvent.setup()
    montar()
    await llegarAlModal(user)
    await llenarTodoMenosVerificar(user)
    await verificarCorreoEnModal(user)

    for (const almacen of [localStorage, sessionStorage]) {
      for (let i = 0; i < almacen.length; i += 1) {
        const clave = almacen.key(i)
        expect(almacen.getItem(clave)).not.toContain(TOKEN_PRUEBA)
        expect(clave).not.toMatch(/verific|token/i)
      }
    }
  })

  it('tras un 409 de horario el comprobante sigue siendo válido: se elige otro bloque sin verificar de nuevo y se reenvía el mismo', async () => {
    const user = userEvent.setup()
    const conflicto = Object.assign(new Error('Ese horario ya está reservado para este barbero, elige otro'), { status: 409 })
    crearCita.mockRejectedValueOnce(conflicto).mockResolvedValueOnce(CITA)
    montar()
    await llegarAlModal(user)
    await llenarTodoMenosVerificar(user)
    await verificarCorreoEnModal(user)

    obtenerDisponibilidad.mockResolvedValueOnce({ horas: ['10:30'] })
    await user.click(confirmarBoton())
    await screen.findByText(/la hora de las 10:00 se ocupó/i)
    expect(screen.queryByRole('dialog')).toBeNull()

    await clickContinuar(user) // vuelve a abrir el modal con la nueva hora
    await screen.findByRole('dialog')
    expect(screen.getByText('Correo verificado')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('juan@example.com')
    // Los datos personales del modal se vuelven a escribir (comportamiento de siempre), el correo NO se vuelve a verificar.
    await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
    await user.type(screen.getByLabelText('Teléfono'), '3001234567')
    await user.click(screen.getByRole('checkbox'))
    await user.click(confirmarBoton())

    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(solicitarCodigoCorreo).toHaveBeenCalledTimes(1)
    expect(confirmarCodigoCorreo).toHaveBeenCalledTimes(1)
    expect(crearCita).toHaveBeenCalledTimes(2)
    expect(crearCita.mock.calls[1][0].verificacion_token).toBe(TOKEN_PRUEBA)
  })

  it.each([
    ['VERIFICACION_EXPIRADA', /venció/i],
    ['VERIFICACION_INVALIDA', /no pudimos validar la verificación/i],
    ['CORREO_NO_COINCIDE', /no coincide/i],
    ['VERIFICACION_REQUERIDA', /verifica tu correo para poder confirmar/i],
  ])('si el servidor responde %s, vuelve a pedir el código y el modal sigue abierto', async (codigo, patron) => {
    const user = userEvent.setup()
    crearCita.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 400, codigo }))
    montar()
    await llegarAlModal(user)
    await llenarTodoMenosVerificar(user)
    await verificarCorreoEnModal(user)
    await user.click(confirmarBoton())

    const alertas = await screen.findAllByRole('alert')
    expect(alertas.map((alerta) => alerta.textContent).join(' ')).toMatch(patron)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Correo verificado')).toBeNull()
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument()
    expect(confirmarBoton()).toBeDisabled()

    // Se puede verificar otra vez y reservar.
    crearCita.mockResolvedValueOnce(CITA)
    await verificarCorreoEnModal(user)
    await user.click(confirmarBoton())
    expect(await screen.findByText(/¡cita agendada con éxito!/i)).toBeInTheDocument()
    expect(solicitarCodigoCorreo).toHaveBeenCalledTimes(2)
  })

  it('una reserva que falla por otro motivo no descarta el comprobante', async () => {
    const user = userEvent.setup()
    crearCita.mockRejectedValueOnce(Object.assign(new Error('Error del servidor'), { status: 500 }))
    montar()
    await llegarAlModal(user)
    await llenarTodoMenosVerificar(user)
    await verificarCorreoEnModal(user)
    await user.click(confirmarBoton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/error del servidor/i)
    expect(screen.getByText('Correo verificado')).toBeInTheDocument()
    expect(confirmarBoton()).not.toBeDisabled()
  })
})

describe('useVerificacionCorreo', () => {
  it('descarta el comprobante a los 30 minutos (un poco antes) y avisa', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useVerificacionCorreo('ana@example.com'))
    await act(async () => {
      await result.current.solicitar()
    })
    await act(async () => {
      await result.current.confirmar(CODIGO_PRUEBA)
    })
    expect(result.current.verificado).toBe(true)
    expect(result.current.token).toBe(TOKEN_PRUEBA)

    await act(async () => {
      vi.advanceTimersByTime(29 * 60 * 1000)
    })
    expect(result.current.verificado).toBe(true)
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000)
    })
    expect(result.current.verificado).toBe(false)
    expect(result.current.token).toBe('')
    expect(result.current.error.mensaje).toMatch(/venció/i)
  })

  it('el comprobante solo vale para el correo verificado (comparado recortado y en minúsculas)', async () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ correo }) => useVerificacionCorreo(correo), { initialProps: { correo: 'ana@example.com' } })
    await act(async () => {
      await result.current.solicitar()
      await result.current.confirmar(CODIGO_PRUEBA)
    })
    expect(result.current.verificado).toBe(true)

    rerender({ correo: '  ANA@Example.com ' })
    expect(result.current.verificado).toBe(true)
    rerender({ correo: 'ana2@example.com' })
    expect(result.current.verificado).toBe(false)
    expect(result.current.token).toBe('')
    rerender({ correo: 'ana@example.com' })
    expect(result.current.verificado).toBe(true)
  })

  it('no hace dos solicitudes a la vez ni acepta un código mal formado', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useVerificacionCorreo('ana@example.com'))
    await act(async () => {
      await Promise.all([result.current.solicitar(), result.current.solicitar()])
    })
    expect(solicitarCodigoCorreo).toHaveBeenCalledTimes(1)
    await act(async () => {
      expect(await result.current.confirmar('12')).toBe(false)
    })
    expect(confirmarCodigoCorreo).not.toHaveBeenCalled()
  })
})

describe('utils/correo', () => {
  it('valida con el mismo criterio que el servidor', () => {
    expect(esCorreoValido('juan@example.com')).toBe(true)
    expect(esCorreoValido('  Juan+x@Example.co ')).toBe(true)
    for (const malo of ['a@b.com,c.d', 'x@y.com>', 'a b@c.com', 'a@b', 'a@@b.com', '', null, undefined, 5, "o'b@x.com", 'a@b.com;c@d.com']) {
      expect(esCorreoValido(malo)).toBe(false)
    }
    expect(esCorreoValido(`${'a'.repeat(65)}@example.com`)).toBe(false)
  })

  it('normaliza recortando y pasando a minúsculas', () => {
    expect(normalizarCorreo('  JUAN@Example.COM ')).toBe('juan@example.com')
    expect(normalizarCorreo(null)).toBe('')
  })
})
