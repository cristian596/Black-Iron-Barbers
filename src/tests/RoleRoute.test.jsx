import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import RoleRoute from '../routes/RoleRoute'
import { useAuth } from '../context/AuthContext'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const renderConRol = (rolUsuario, rolRequerido) =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RoleRoute rol={rolRequerido}>
              <p>Contenido protegido</p>
            </RoleRoute>
          }
        />
        <Route path="/panel" element={<p>Panel de barbero</p>} />
        <Route path="/login-barberos" element={<p>Login</p>} />
      </Routes>
    </MemoryRouter>
  )

describe('RoleRoute', () => {
  it('redirige a /panel cuando el rol del usuario no corresponde a la ruta', () => {
    useAuth.mockReturnValue({ usuario: { rol: 'barbero' } })

    renderConRol('barbero', 'admin')

    expect(screen.getByText('Panel de barbero')).toBeInTheDocument()
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
  })

  it('muestra el contenido cuando el rol coincide', () => {
    useAuth.mockReturnValue({ usuario: { rol: 'admin' } })

    renderConRol('admin', 'admin')

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument()
  })

  it('redirige al login cuando no hay usuario autenticado', () => {
    useAuth.mockReturnValue({ usuario: null })

    renderConRol(null, 'admin')

    expect(screen.getByText('Login')).toBeInTheDocument()
  })
})
