import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ModalConfirmacion from '../components/sections/reserva/ModalConfirmacion'

const SERVICIO = { id: 1, nombre: 'Corte de Cabello', duracion_min: 35, precio: 55000 }
const BARBERO = { id: 1, nombre: 'Boby' }

const renderModal = (props = {}) =>
  render(
    <ModalConfirmacion
      servicios={[SERVICIO]}
      barbero={BARBERO}
      fecha="2030-06-15"
      hora="10:00"
      onClose={vi.fn()}
      onConfirmar={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  )

const llenarFormularioValido = async (user) => {
  await user.type(screen.getByLabelText('Nombre'), 'Juan Pérez')
  await user.type(screen.getByLabelText('Correo electrónico'), 'juan@example.com')
  await user.type(screen.getByLabelText('Teléfono'), '3001234567')
  await user.click(screen.getByRole('checkbox'))
}

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

  it('no envía el formulario si falta el nombre, el correo es inválido, el teléfono es inválido o falta el consentimiento', async () => {
    const onConfirmar = vi.fn()
    const user = userEvent.setup()
    renderModal({ onConfirmar })

    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre es obligatorio/i)
    expect(onConfirmar).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Nombre'), 'Juan')
    await user.type(screen.getByLabelText('Correo electrónico'), 'no-es-un-correo')
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/correo no es válido/i)
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
})
