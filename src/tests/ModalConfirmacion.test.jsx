import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ModalConfirmacion from '../components/sections/reserva/ModalConfirmacion'
import { useVerificacionCorreo } from '../hooks/useVerificacionCorreo'
import * as api from '../services/api'
import { CODIGO_PRUEBA, TOKEN_PRUEBA, prepararVerificacionMock, verificarCorreoEnModal } from './verificacionPrueba'

vi.mock('../services/api', () => ({
  solicitarCodigoCorreo: vi.fn(),
  confirmarCodigoCorreo: vi.fn(),
  comprobarAsesoriaGratis: vi.fn(),
}))

const SERVICIO = { id: 1, nombre: 'Corte de Cabello', duracion_min: 35, precio: 55000 }
const BARBERO = { id: 1, nombre: 'Boby' }

// MODIFICADO: el correo y su verificación ahora viven en el padre (ReservaCorte) y llegan por props. Este contenedor hace
// lo mismo que la página: guarda el correo y usa el hook REAL de verificación (con el API mockeado).
const Contenedor = ({ correoInicial = '', ...props }) => {
  const [correo, setCorreo] = useState(correoInicial)
  const verificacion = useVerificacionCorreo(correo)
  return <ModalConfirmacion correo={correo} onCorreoChange={setCorreo} verificacion={verificacion} {...props} />
}

const renderModal = (props = {}) =>
  render(
    <Contenedor
      servicios={[SERVICIO]}
      barbero={BARBERO}
      fecha="2030-06-15"
      hora="10:00"
      onClose={vi.fn()}
      onConfirmar={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  )

// MODIFICADO: ahora, tras escribir el correo, hay que verificarlo (pedir el código y confirmarlo) antes de poder confirmar.
const llenarFormularioValido = async (user) => {
  await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
  await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
  await verificarCorreoEnModal(user)
  await user.type(screen.getByLabelText('Teléfono'), '3001234567')
  await user.click(screen.getByRole('checkbox'))
}

beforeEach(() => {
  vi.clearAllMocks()
  prepararVerificacionMock()
})

describe('ModalConfirmacion', () => {
  it('muestra el resumen de la reserva (servicio, barbero, fecha, hora, duración y total)', () => {
    renderModal()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Corte de Cabello')).toBeInTheDocument()
    expect(screen.getByText('Boby')).toBeInTheDocument()
    expect(screen.getByText('Bloque 10–11 · tu cita es a las 10:00')).toBeInTheDocument()
    expect(screen.getByText('35 min')).toBeInTheDocument()
    expect(screen.getByText('$55.000')).toBeInTheDocument()
  })

  it('con "Cualquier barbero" (barbero=null), muestra el texto genérico', () => {
    renderModal({ barbero: null })
    expect(screen.getByText('Cualquier barbero disponible')).toBeInTheDocument()
  })

  it('el foco inicial va al campo Nombre', () => {
    renderModal()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  it('se cierra con la tecla Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderModal({ onClose })

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('se cierra al hacer clic en el botón de cerrar', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderModal({ onClose })

    await user.click(screen.getByRole('button', { name: /cerrar/i }))

    expect(onClose).toHaveBeenCalled()
  })

  // MODIFICADO: antes se probaba aquí también el aviso de "correo no es válido" al pulsar Confirmar. Ahora Confirmar
  // permanece deshabilitado hasta verificar el correo (que solo se puede con un correo válido), así que ese aviso se
  // comprueba al pedir el código (siguiente prueba) y aquí solo quedan las validaciones del resto del formulario.
  it('no envía el formulario si falta el nombre, el teléfono es inválido o falta el consentimiento', async () => {
    const onConfirmar = vi.fn()
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
    await verificarCorreoEnModal(user)

    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre es obligatorio/i)
    expect(onConfirmar).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Nombre'), 'Juan')
    await user.type(screen.getByLabelText('Teléfono'), '123')
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/teléfono debe ser/i)

    await user.clear(screen.getByLabelText('Teléfono'))
    await user.type(screen.getByLabelText('Teléfono'), '3001234567')
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/tratamiento de datos/i)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('al enviar datos válidos, llama a onConfirmar con los datos de contacto', async () => {
    const onConfirmar = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await llenarFormularioValido(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    await waitFor(() =>
      expect(onConfirmar).toHaveBeenCalledWith({
        cliente: 'Juan Pérez',
        correo: 'juan@example.com',
        telefono: '3001234567',
        consentimiento: true,
      })
    )
  })

  it('deshabilita "Confirmar reserva" mientras se envía, para evitar doble envío', async () => {
    let resolver
    const onConfirmar = vi.fn(() => new Promise((resolve) => { resolver = resolve }))
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await llenarFormularioValido(user)
    const boton = screen.getByRole('button', { name: /confirmar reserva/i })
    await user.click(boton)

    expect(boton).toBeDisabled()
    resolver()
    await waitFor(() => expect(boton).not.toBeDisabled())
  })

  it('muestra el mensaje del servidor cuando la API responde 400', async () => {
    const error = new Error('El servicio no cabe dentro del horario de atención a esa hora')
    error.status = 400
    const onConfirmar = vi.fn().mockRejectedValue(error)
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await llenarFormularioValido(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El servicio no cabe dentro del horario de atención a esa hora'
    )
  })

  it('muestra un mensaje de "demasiados intentos" cuando la API responde 429', async () => {
    const error = new Error('Demasiadas solicitudes de reserva, intenta más tarde')
    error.status = 429
    const onConfirmar = vi.fn().mockRejectedValue(error)
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await llenarFormularioValido(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/demasiados intentos/i)
  })

  it('muestra un mensaje de error de red cuando la API no responde (sin status)', async () => {
    const error = new Error('No se pudo conectar con el servidor')
    const onConfirmar = vi.fn().mockRejectedValue(error)
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await llenarFormularioValido(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo conectar/i)
  })

  it.each([
    ['VERIFICACION_EXPIRADA', /verificación de tu correo venció/i],
    ['VERIFICACION_INVALIDA', /no pudimos validar la verificación/i],
    ['VERIFICACION_REQUERIDA', /verifica tu correo/i],
    ['CORREO_NO_COINCIDE', /no coincide/i],
  ])('si el servidor responde %s, muestra el motivo en español', async (codigo, patron) => {
    const error = new Error('mensaje del servidor')
    error.status = 400
    error.codigo = codigo
    const onConfirmar = vi.fn().mockRejectedValue(error)
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await llenarFormularioValido(user)
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(patron)
  })
})

describe('ModalConfirmacion — verificación del correo', () => {
  it('muestra el bloque "Verifica tu correo" y deja "Confirmar reserva" deshabilitado con una explicación accesible', async () => {
    const user = userEvent.setup()
    const onConfirmar = vi.fn()
    renderModal({ onConfirmar })

    expect(screen.getByRole('heading', { name: 'Verifica tu correo' })).toBeInTheDocument()
    const confirmar = screen.getByRole('button', { name: /confirmar reserva/i })
    expect(confirmar).toBeDisabled()
    const aviso = screen.getByText('Verifica tu correo para poder confirmar la reserva.')
    expect(confirmar.getAttribute('aria-describedby')).toContain(aviso.id)

    // Rellenar todo lo demás no basta: sigue deshabilitado hasta verificar.
    await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
    await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
    await user.type(screen.getByLabelText('Teléfono'), '3001234567')
    await user.click(screen.getByRole('checkbox'))
    expect(confirmar).toBeDisabled()
    await user.click(confirmar)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('flujo feliz: enviar código, escribirlo, verificar; el foco va al campo del código y luego al botón de confirmar', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText('Correo electrónico'), 'Juan@Example.com')

    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(api.solicitarCodigoCorreo).toHaveBeenCalledWith('juan@example.com')
    const campo = await screen.findByLabelText('Código de verificación')
    await waitFor(() => expect(campo).toHaveFocus())

    await user.type(campo, CODIGO_PRUEBA)
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(api.confirmarCodigoCorreo).toHaveBeenCalledWith('juan@example.com', CODIGO_PRUEBA)

    expect(await screen.findByText('Correo verificado')).toBeInTheDocument()
    const confirmar = screen.getByRole('button', { name: /confirmar reserva/i })
    await waitFor(() => expect(confirmar).toHaveFocus())
    expect(confirmar).not.toBeDisabled()
    expect(screen.queryByText('Verifica tu correo para poder confirmar la reserva.')).toBeNull()
  })

  it('el campo del código es numérico, de 6 dígitos y solo admite dígitos', async () => {
    const user = userEvent.setup()
    renderModal({ correoInicial: 'juan@example.com' })
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    const campo = await screen.findByLabelText('Código de verificación')

    expect(campo).toHaveAttribute('inputmode', 'numeric')
    expect(campo).toHaveAttribute('autocomplete', 'one-time-code')
    expect(campo).toHaveAttribute('maxlength', '6')
    await user.type(campo, '12ab34-5678')
    expect(campo).toHaveValue('123456')
  })

  it('un código incorrecto muestra el aviso y deja intentar de nuevo', async () => {
    const user = userEvent.setup()
    const error = new Error('El código no es válido o venció. Pide uno nuevo.')
    error.status = 400
    error.codigo = 'CODIGO_INVALIDO'
    api.confirmarCodigoCorreo.mockRejectedValueOnce(error)
    renderModal({ correoInicial: 'juan@example.com' })
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    const campo = await screen.findByLabelText('Código de verificación')

    await user.type(campo, '000000')
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/código es incorrecto o ya venció/i)
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeDisabled()

    await user.clear(campo)
    await user.type(campo, CODIGO_PRUEBA)
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(await screen.findByText('Correo verificado')).toBeInTheDocument()
  })

  it('un código de menos de 6 dígitos no llama al servidor', async () => {
    const user = userEvent.setup()
    renderModal({ correoInicial: 'juan@example.com' })
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    await user.type(await screen.findByLabelText('Código de verificación'), '123')
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/6 dígitos/)
    expect(api.confirmarCodigoCorreo).not.toHaveBeenCalled()
  })

  it('con un correo inválido, "Enviar código" avisa y no llama al servidor', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText('Correo electrónico'), 'no-es-un-correo')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/correo válido/i)
    expect(api.solicitarCodigoCorreo).not.toHaveBeenCalled()
  })

  it('un correo con coma o ángulos tampoco se acepta para pedir el código', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByLabelText('Correo electrónico'), 'a@b.com,c.d')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/correo válido/i)
    expect(api.solicitarCodigoCorreo).not.toHaveBeenCalled()
  })

  it('cambiar el correo después de verificar descarta el comprobante y vuelve a pedir el código', async () => {
    const user = userEvent.setup()
    const onConfirmar = vi.fn().mockResolvedValue(undefined)
    renderModal({ onConfirmar })
    await llenarFormularioValido(user)
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).not.toBeDisabled()

    await user.type(screen.getByLabelText('Correo electrónico'), 'x')

    expect(screen.queryByText('Correo verificado')).toBeNull()
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('volver a escribir exactamente el correo verificado (con otras mayúsculas) recupera la verificación', async () => {
    const user = userEvent.setup()
    renderModal()
    await llenarFormularioValido(user)
    const campoCorreo = screen.getByLabelText('Correo electrónico')

    await user.type(campoCorreo, 'x')
    expect(screen.queryByText('Correo verificado')).toBeNull()
    await user.type(campoCorreo, '{Backspace}')
    await user.clear(campoCorreo)
    await user.type(campoCorreo, '  JUAN@example.com ')
    expect(screen.getByText('Correo verificado')).toBeInTheDocument()
  })

  it('"Cambiar correo" reinicia la verificación y lleva el foco al campo del correo', async () => {
    const user = userEvent.setup()
    renderModal()
    await llenarFormularioValido(user)

    await user.click(screen.getByRole('button', { name: 'Cambiar correo' }))

    expect(screen.queryByText('Correo verificado')).toBeNull()
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeDisabled()
  })

  it('el comprobante y el código no aparecen nunca en la pantalla', async () => {
    const user = userEvent.setup()
    renderModal()
    await llenarFormularioValido(user)
    expect(document.body.textContent).not.toContain(TOKEN_PRUEBA)
    expect(document.body.innerHTML).not.toContain(TOKEN_PRUEBA)
    expect(screen.queryByDisplayValue(TOKEN_PRUEBA)).toBeNull()
    expect(document.body.textContent).not.toContain(CODIGO_PRUEBA)
  })

  it.each([
    ['ESPERA_REQUERIDA', 429, 40, /Ya te enviamos un código.*40 segundos/i],
    ['LIMITE_CODIGOS_HORA', 429, 1500, /demasiados códigos.*25 minutos/i],
    ['DEMASIADOS_INTENTOS', 429, 120, /demasiados códigos.*2 minutos/i],
    ['CORREO_NO_DISPONIBLE', 503, undefined, /no pudimos enviar el código/i],
  ])('al pedir el código, %s se explica con claridad', async (codigo, status, reintentar, patron) => {
    const user = userEvent.setup()
    const error = new Error('x')
    error.status = status
    error.codigo = codigo
    if (reintentar) error.reintentar_en_seg = reintentar
    api.solicitarCodigoCorreo.mockRejectedValueOnce(error)
    renderModal({ correoInicial: 'juan@example.com' })

    await user.click(screen.getByRole('button', { name: 'Enviar código' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(patron)
    expect(screen.getByRole('button', { name: /confirmar reserva/i })).toBeDisabled()
  })

  it('al verificar, el límite de intentos (429) muestra la espera', async () => {
    const user = userEvent.setup()
    const error = new Error('x')
    error.status = 429
    error.codigo = 'DEMASIADOS_INTENTOS'
    error.reintentar_en_seg = 600
    api.confirmarCodigoCorreo.mockRejectedValueOnce(error)
    renderModal({ correoInicial: 'juan@example.com' })
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    await user.type(await screen.findByLabelText('Código de verificación'), CODIGO_PRUEBA)
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/demasiados intentos.*10 minutos/i)
  })

  it('si el servidor dice que aún hay que esperar, queda en el paso del código con la cuenta regresiva', async () => {
    const user = userEvent.setup()
    const error = new Error('x')
    error.status = 429
    error.codigo = 'ESPERA_REQUERIDA'
    error.reintentar_en_seg = 40
    api.solicitarCodigoCorreo.mockRejectedValueOnce(error)
    renderModal({ correoInicial: 'juan@example.com' })
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByLabelText('Código de verificación')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reenviar código \(\d+ s\)/ })).toBeDisabled()
  })
})

describe('ModalConfirmacion — reenvío con cuenta regresiva', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('"Reenviar código" está deshabilitado 60 s con la cuenta visible y luego vuelve a enviar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderModal({ correoInicial: 'juan@example.com' })
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    await screen.findByLabelText('Código de verificación')

    const reenviar = screen.getByRole('button', { name: /Reenviar código \(60 s\)/ })
    expect(reenviar).toBeDisabled()
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByRole('button', { name: /Reenviar código \((29|30) s\)/ })).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(31_000)
    })
    const habilitado = screen.getByRole('button', { name: 'Reenviar código' })
    expect(habilitado).not.toBeDisabled()
    await user.click(habilitado)
    expect(api.solicitarCodigoCorreo).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('button', { name: /Reenviar código \(60 s\)/ })).toBeDisabled()
  })
})
