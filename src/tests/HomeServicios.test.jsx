import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home'
import * as api from '../services/api'
import { reiniciarCacheBarberos } from '../hooks/useCantidadBarberos'

vi.mock('../services/api')

beforeEach(() => {
  reiniciarCacheBarberos()
  vi.mocked(api.obtenerBarberos).mockResolvedValue([
    { id: 1, nombre: 'Andrés', cargo: 'Barbero', especialidad: 'Fade', foto: '/a.jpg' },
  ])
})

const montar = async () => {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
  await screen.findByText('Andrés')
}

describe('Home sin la carta de servicios', () => {
  it('no incluye el catálogo y no pide servicios a la API', async () => {
    await montar()

    expect(screen.queryByRole('heading', { name: 'NUESTRA CARTA DE SERVICIOS' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar servicios' })).not.toBeInTheDocument()
    expect(api.obtenerServicios).not.toHaveBeenCalled()
  })

  it('mantiene enlaces claros a la página de servicios', async () => {
    await montar()

    expect(screen.getByRole('link', { name: 'Ver servicios' })).toHaveAttribute('href', '/cortes')
    expect(screen.getByRole('button', { name: /Por servicio/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mas Información' })).toHaveAttribute('href', '/cortes')
  })
})
