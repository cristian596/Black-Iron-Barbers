import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ContenedorModal from './ContenedorModalPrueba'
import * as api from '../services/api'
import { prepararVerificacionMock } from './verificacionPrueba'

vi.mock('../services/api', () => ({
  solicitarCodigoCorreo: vi.fn(),
  confirmarCodigoCorreo: vi.fn(),
  comprobarAsesoriaGratis: vi.fn(),
}))

const SERVICIO = { id: 1, nombre: 'Corte de Cabello', duracion_min: 35, precio: 55000 }

const montar = (props = {}) =>
  render(
    <ContenedorModal
      servicios={[SERVICIO]}
      barbero={{ id: 1, nombre: 'Boby' }}
      fecha="2030-06-15"
      hora="10:00"
      onClose={vi.fn()}
      onConfirmar={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  )

const casilla = () => screen.getByRole('checkbox')
const enviarCodigo = (user) => user.click(screen.getByRole('button', { name: 'Enviar código' }))

beforeEach(() => {
  vi.clearAllMocks()
  prepararVerificacionMock()
})

describe('Reserva: casilla de tratamiento de datos', () => {
  it('es la única casilla, empieza desmarcada y tiene su etiqueta asociada', () => {
    montar()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(casilla()).not.toBeChecked()
    expect(casilla()).toHaveAccessibleName(/He leído y acepto el tratamiento de mis datos personales/)
  })

  it('enlaza la Política de Tratamiento de Datos y la de Privacidad, en una pestaña nueva y de forma segura', () => {
    montar()
    const etiqueta = casilla().closest('label')

    const datos = within(etiqueta).getByRole('link', { name: 'Política de Tratamiento de Datos Personales' })
    const privacidad = within(etiqueta).getByRole('link', { name: 'Política de Privacidad' })

    expect(datos).toHaveAttribute('href', '/tratamiento-de-datos')
    expect(privacidad).toHaveAttribute('href', '/politica-de-privacidad')
    for (const enlace of [datos, privacidad]) {
      expect(enlace).toHaveAttribute('target', '_blank')
      expect(enlace.getAttribute('rel')).toMatch(/noopener/)
      expect(enlace.getAttribute('rel')).toMatch(/noreferrer/)
    }
  })

  it('sin marcarla, "Enviar código" no llama al servidor: muestra el error bajo la casilla y le da el foco', async () => {
    const user = userEvent.setup()
    montar({ correoInicial: 'ana@example.com' })

    await enviarCodigo(user)

    expect(api.solicitarCodigoCorreo).not.toHaveBeenCalled()
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('Debes aceptar el tratamiento de datos personales para continuar')
    expect(casilla()).toHaveAttribute('aria-invalid', 'true')
    expect(casilla()).toHaveAttribute('aria-describedby', error.id)
    await waitFor(() => expect(casilla()).toHaveFocus())
  })

  it('al marcarla desaparece el error y "Enviar código" ya pide el código', async () => {
    const user = userEvent.setup()
    montar({ correoInicial: 'ana@example.com' })
    await enviarCodigo(user)
    await screen.findByRole('alert')

    await user.click(casilla())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(casilla()).not.toHaveAttribute('aria-invalid')
    await enviarCodigo(user)
    await waitFor(() => expect(api.solicitarCodigoCorreo).toHaveBeenCalledTimes(1))
  })

  it('el consentimiento se exige ANTES de tratar el correo: aparece antes del bloque "Verifica tu correo"', () => {
    montar()
    const bloque = screen.getByRole('region', { name: 'Verifica tu correo' })
    expect(casilla().compareDocumentPosition(bloque) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
