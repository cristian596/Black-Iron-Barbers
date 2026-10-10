import { screen } from '@testing-library/react'
import { vi } from 'vitest'
import * as api from '../services/api'

// Ayudas de PRUEBA para la verificación del correo en el flujo de reserva. Las suites que recorren el modal mockean
// src/services/api.js; aquí se preparan las dos llamadas de verificación y se recorre el bloque "Verifica tu correo".

export const TOKEN_PRUEBA = 'comprobante-de-prueba'
export const CODIGO_PRUEBA = '123456'

// Respuestas por defecto del API de verificación (llamar en beforeEach, después de vaciar/reiniciar los mocks).
export const prepararVerificacionMock = () => {
  vi.mocked(api.solicitarCodigoCorreo).mockReset().mockResolvedValue({ ok: true, reenviar_en_seg: 60 })
  vi.mocked(api.confirmarCodigoCorreo).mockReset().mockResolvedValue({ token: TOKEN_PRUEBA, expira_en_seg: 1800 })
}

// Con el correo ya escrito: pide el código, lo escribe y lo verifica. Al terminar el correo está verificado.
export const verificarCorreoEnModal = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Enviar código' }))
  const campo = await screen.findByLabelText('Código de verificación')
  await user.type(campo, CODIGO_PRUEBA)
  await user.click(screen.getByRole('button', { name: 'Verificar código' }))
  await screen.findByText('Correo verificado')
}

// Estado "sin verificar" para renderizar ModalConfirmacion cuando la prueba no trata la verificación.
export const VERIFICACION_VACIA = {
  verificado: false,
  token: '',
  codigoSolicitado: false,
  pendiente: '',
  error: null,
  restante: 0,
  solicitar: () => {},
  confirmar: () => {},
  descartar: () => {},
  cambiarCorreo: () => {},
}
