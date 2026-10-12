import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../context/AuthContext'
import CambiarContrasena from '../components/dashboard/CambiarContrasena'
import * as api from '../services/api'

vi.mock('../services/api')

// Pentest (fase 2): cambiar la contraseña invalida los tokens anteriores en el servidor y la respuesta trae uno nuevo. El front
// debe adoptarlo para que quien la cambia siga en sesión, y no debe guardar nada si la respuesta no trae token.

// Un token con forma de JWT (el front solo decodifica el payload; el servidor es quien lo verifica).
const jwtDe = (payload) => `x.${btoa(JSON.stringify(payload))}.y`
const TOKEN_VIEJO = jwtDe({ id: 2, usuario: 'leo', rol: 'barbero', barbero_id: 2, exp: Math.floor(Date.now() / 1000) + 3600 })
const TOKEN_NUEVO = jwtDe({ id: 2, usuario: 'leo', rol: 'barbero', barbero_id: 2, v: 1, exp: Math.floor(Date.now() / 1000) + 7200 })

const Espia = () => {
  const { token, renovarToken } = useAuth()
  return (
    <>
      <p data-testid="token">{token}</p>
      <button onClick={() => renovarToken(TOKEN_NUEVO)}>renovar</button>
      <button onClick={() => renovarToken(undefined)}>renovar-vacio</button>
      <button onClick={() => renovarToken({ no: 'texto' })}>renovar-objeto</button>
    </>
  )
}

beforeEach(() => localStorage.setItem('token', TOKEN_VIEJO))
afterEach(() => localStorage.clear())

describe('AuthContext.renovarToken', () => {
  it('guarda el token nuevo en memoria y en localStorage', async () => {
    render(
      <AuthProvider>
        <Espia />
      </AuthProvider>
    )
    expect(screen.getByTestId('token')).toHaveTextContent(TOKEN_VIEJO)
    await userEvent.click(screen.getByText('renovar'))
    expect(screen.getByTestId('token')).toHaveTextContent(TOKEN_NUEVO)
    expect(localStorage.getItem('token')).toBe(TOKEN_NUEVO)
  })

  it('ignora valores que no son un texto (no borra ni cambia la sesión)', async () => {
    render(
      <AuthProvider>
        <Espia />
      </AuthProvider>
    )
    await userEvent.click(screen.getByText('renovar-vacio'))
    await userEvent.click(screen.getByText('renovar-objeto'))
    expect(screen.getByTestId('token')).toHaveTextContent(TOKEN_VIEJO)
    expect(localStorage.getItem('token')).toBe(TOKEN_VIEJO)
  })
})

describe('CambiarContrasena adopta el token que devuelve el servidor', () => {
  it('tras cambiarla, la sesión pasa a usar el token nuevo', async () => {
    vi.mocked(api.cambiarContrasena).mockResolvedValue({ mensaje: 'ok', token: TOKEN_NUEVO, vigencia: null })
    render(
      <AuthProvider>
        <Espia />
        <CambiarContrasena token={TOKEN_VIEJO} />
      </AuthProvider>
    )
    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'actual-clave-1')
    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'Cuatro-gatos-azules-77')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Cuatro-gatos-azules-77')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent(TOKEN_NUEVO))
    expect(localStorage.getItem('token')).toBe(TOKEN_NUEVO)
  })

  it('si el servidor rechaza la contraseña por débil, se muestra su mensaje en el campo y la sesión no cambia', async () => {
    vi.mocked(api.cambiarContrasena).mockRejectedValue(
      Object.assign(new Error('La contraseña es demasiado común o fácil de adivinar'), { campo: 'nueva', codigo: 'CONTRASENA_DEBIL' })
    )
    render(
      <AuthProvider>
        <Espia />
        <CambiarContrasena token={TOKEN_VIEJO} />
      </AuthProvider>
    )
    await act(async () => {})
    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'actual-clave-1')
    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'password123')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText(/demasiado común/)).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBe(TOKEN_VIEJO)
  })
})
