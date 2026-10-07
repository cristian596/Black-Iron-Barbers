import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import * as api from '../services/api'

vi.mock('../services/api')

// Las páginas cargan con React.lazy: margen de espera para la suite completa (no cambia lo que se verifica).
const ESPERA = 10_000
const ESPERA_TEST = 20_000

const montar = (ruta) => {
  const router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
  return router
}

let llamadas
beforeEach(() => {
  localStorage.clear()
  llamadas = []
  Element.prototype.scrollIntoView = vi.fn(function () {
    llamadas.push(this.id)
  })
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 1, nombre: 'A', foto: '' }])
  vi.mocked(api.obtenerServicios).mockResolvedValue([])
  vi.mocked(api.obtenerDisponibilidad).mockResolvedValue([])
})

afterEach(() => {
  delete Element.prototype.scrollIntoView
})

describe('Rutas de asesorías', () => {
  it('/asesorias carga dentro del layout público', async () => {
    montar('/asesorias')

    expect(await screen.findByRole('heading', { level: 1, name: 'Asesorías de imagen' }, { timeout: ESPERA })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByText(/Garantía de satisfacción/)).toBeInTheDocument()
  }, ESPERA_TEST)

  it('/asesoria redirige a /asesorias conservando el hash', async () => {
    const router = montar('/asesoria#premium')

    await screen.findByRole('heading', { level: 1, name: 'Asesorías de imagen' }, { timeout: ESPERA })
    expect(router.state.location.pathname).toBe('/asesorias')
    expect(router.state.location.hash).toBe('#premium')
    await waitFor(() => expect(llamadas).toContain('premium'))
  }, ESPERA_TEST)

  it('/asesoria sin hash redirige a /asesorias a secas', async () => {
    const router = montar('/asesoria')

    await screen.findByRole('heading', { level: 1, name: 'Asesorías de imagen' }, { timeout: ESPERA })
    expect(router.state.location.pathname).toBe('/asesorias')
    expect(router.state.location.hash).toBe('')
  }, ESPERA_TEST)

  it('el botón antiguo de asesoría gratis llega a la sección #gratis', async () => {
    const router = montar('/asesorias#gratis')

    await screen.findByRole('heading', { level: 2, name: 'Asesoría de imagen gratis' }, { timeout: ESPERA })
    expect(router.state.location.hash).toBe('#gratis')
    await waitFor(() => expect(llamadas).toContain('gratis'))
  }, ESPERA_TEST)
})

// Landingpage + useScrollAHash: arregla /#equipo (antes no hacía scroll).
describe('Landingpage: scroll a /#equipo', () => {
  it('al cargar con #equipo, espera a que cargue el Home, hace scroll y enfoca el título', async () => {
    montar('/#equipo')

    await waitFor(() => expect(llamadas).toContain('equipo'), { timeout: ESPERA })
    expect(document.getElementById('titulo-equipo')).toHaveFocus()
  }, ESPERA_TEST)

  it('llegando desde otra ruta (botón "Por barbero": navigate("/#equipo")) también hace scroll', async () => {
    const router = montar('/cortes')
    await screen.findByRole('banner', {}, { timeout: ESPERA })
    expect(llamadas).toHaveLength(0)

    await act(async () => {
      await router.navigate('/#equipo')
    })

    await waitFor(() => expect(llamadas).toContain('equipo'), { timeout: ESPERA })
  }, ESPERA_TEST)

  it('con el Home ya abierto, repetir #equipo vuelve a hacer scroll', async () => {
    const router = montar('/#equipo')
    await waitFor(() => expect(llamadas).toHaveLength(1), { timeout: ESPERA })

    await act(async () => {
      await router.navigate('/#equipo')
    })
    await waitFor(() => expect(llamadas).toHaveLength(2))
  }, ESPERA_TEST)

  it('un hash desconocido no hace scroll', async () => {
    montar('/#no-existe')
    await screen.findByText(/Garantía de satisfacción/, {}, { timeout: ESPERA })
    await new Promise((r) => setTimeout(r, 100))
    expect(llamadas).toHaveLength(0)
  }, ESPERA_TEST)
})
