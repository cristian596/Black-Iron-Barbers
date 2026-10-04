import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import * as api from '../services/api'

vi.mock('../services/api')

// Cada página se carga con React.lazy: con la CPU saturada (suite completa, varios archivos a la vez)
// el límite por defecto de 1 s de findBy/waitFor no alcanza. Es solo margen de espera, no cambia lo que se verifica.
const ESPERA_CARGA = 10_000
const ESPERA_TEST = 20_000

const montar = (ruta) => {
  const router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  return {
    router,
    ...render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    ),
  }
}

const rutasPublicas = [
  ['inicio', '/'],
  ['servicios', '/cortes'],
  ['reserva', '/reservar-corte'],
  ['acceso', '/acceso'],
  ['404', '/una-ruta-que-no-existe'],
  ['404 (ubicación eliminada)', '/ubicacion'],
  ['404 (carta eliminada)', '/carta-bebidas'],
]

describe('NavBar en todas las rutas', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 1, nombre: 'A', foto: '' }])
    vi.mocked(api.obtenerServicios).mockResolvedValue([])
    vi.mocked(api.obtenerDisponibilidad).mockResolvedValue([])
  })

  it.each(rutasPublicas)('%s (%s): muestra garantía, menú pegajoso y un solo h1', async (_n, ruta) => {
    montar(ruta)

    const header = await screen.findByRole('banner', {}, { timeout: ESPERA_CARGA })
    expect(header).toHaveClass('sticky', 'top-0')
    expect(within(header).getByRole('link', { name: /Agendar/ })).toHaveAttribute(
      'href',
      '/reservar-corte'
    )
    expect(screen.getByText(/Garantía de satisfacción/)).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('main .animate-spin')).toBeNull(), { timeout: ESPERA_CARGA })
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(1)
    // El acceso interno nunca aparece como enlace público
    const hrefs = screen.getAllByRole('link', { hidden: true }).map((a) => a.getAttribute('href'))
    expect(hrefs.some((h) => /^\/(acceso|panel|admin)/.test(h))).toBe(false)
  }, ESPERA_TEST)

  it('en /acceso el menú no marca ningún enlace como activo', async () => {
    montar('/acceso')
    const nav = within(await screen.findByRole('navigation', { name: 'Principal' }, { timeout: ESPERA_CARGA }))
    nav.getAllByRole('link').forEach((a) => expect(a).not.toHaveAttribute('aria-current'))
  }, ESPERA_TEST)

  it.each([['/panel'], ['/admin'], ['/admin/citas'], ['/admin/servicios'], ['/admin/empleados'], ['/admin/reportes']])('%s sin sesión redirige al acceso sin romperse', async (ruta) => {
    const { router } = montar(ruta)

    await screen.findByRole('banner', {}, { timeout: ESPERA_CARGA })
    expect(router.state.location.pathname).toBe('/acceso')
  }, ESPERA_TEST)
})
