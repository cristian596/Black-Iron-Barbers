import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom'
import ScrollToTop from '../components/layout/ScrollToTop'

const Pagina = ({ nombre }) => (
  <div>
    <p>{nombre}</p>
    <Link to="/otra">ir otra</Link>
    <Link to="/otra#seccion">ir otra con hash</Link>
    <Link to="/inicio?x=1">misma ruta con query</Link>
  </div>
)

const montar = (inicial = '/inicio') => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ScrollToTop />
            <Pagina nombre="pagina" />
          </>
        ),
        children: [{ path: '*', element: null }],
      },
    ],
    { initialEntries: [inicial] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('ScrollToTop', () => {
  let scrollTo

  beforeEach(() => {
    scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no hace scroll al montar', () => {
    montar()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('sube al inicio al navegar a otra ruta', async () => {
    const router = montar()
    await act(() => router.navigate('/otra'))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('sube al inicio con replace a otra ruta', async () => {
    const router = montar()
    await act(() => router.navigate('/otra', { replace: true }))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('no hace scroll si la URL trae hash', async () => {
    const router = montar()
    await act(() => router.navigate('/otra#seccion'))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('no hace scroll en navegación POP (atrás)', async () => {
    const router = montar()
    await act(() => router.navigate('/otra'))
    scrollTo.mockClear()
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/inicio')
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('no hace scroll si solo cambia la query', async () => {
    const router = montar()
    await act(() => router.navigate('/inicio?x=1'))
    expect(scrollTo).not.toHaveBeenCalled()
    await act(() => router.navigate('/inicio?x=2'))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('navegar con un Link también sube al inicio', async () => {
    montar()
    await act(async () => screen.getByText('ir otra').click())
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
