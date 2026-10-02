import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginBarberos from '../pages/LoginBarberos'
import { AuthProvider } from '../context/AuthContext'
import { login as loginRequest } from '../services/api'

vi.mock('../services/api', () => ({
  login: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}))

const renderLogin = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/acceso']}>
        <Routes>
          <Route path="/acceso" element={<LoginBarberos />} />
          <Route path="/admin" element={<p>Panel de administrador</p>} />
          <Route path="/panel" element={<p>Panel de barbero</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )

describe('LoginBarberos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('muestra un mensaje de error cuando el login falla', async () => {
    loginRequest.mockRejectedValueOnce(new Error('Usuario o contraseña incorrectos'))
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'barbero1')
    await user.type(screen.getByLabelText('Contraseña'), 'claveincorrecta')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText('Usuario o contraseña incorrectos')).toBeInTheDocument()
  })

  it('redirige a /admin cuando el usuario autenticado es admin', async () => {
    loginRequest.mockResolvedValueOnce({
      token: 'token-admin',
      usuario: { id: 1, usuario: 'admin', rol: 'admin', barbero_id: null },
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'claveadmin')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText('Panel de administrador')).toBeInTheDocument()
  })

  it('redirige a /panel cuando el usuario autenticado es barbero', async () => {
    loginRequest.mockResolvedValueOnce({
      token: 'token-barbero',
      usuario: { id: 2, usuario: 'barbero1', rol: 'barbero', barbero_id: 1 },
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'barbero1')
    await user.type(screen.getByLabelText('Contraseña'), 'clavebarbero')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText('Panel de barbero')).toBeInTheDocument()
  })
})
