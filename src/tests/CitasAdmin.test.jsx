import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import Citas from '../pages/admin/Citas'
import * as api from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { usuario: 'admin', rol: 'admin' } }),
}))

const TOTAL = 435 // 29 páginas de 15

const cita = (id, sobrescribir = {}) => ({
  id,
  cliente: `Cliente ${id}`,
  correo: 'c@example.com',
  telefono: '3001234567',
  fecha: '2026-10-05',
  hora: '10:00:00',
  estado: 'pendiente',
  servicio_nombre: 'Corte clásico',
  barbero_id: 1,
  barbero_nombre: 'Leo',
  vencida: false,
  ...sobrescribir,
})

// API falsa paginada: devuelve la página pedida de un total fijo (vacía si la página no existe).
const respuestaPaginada = (total = TOTAL) => async (_token, filtros) => {
  const pagina = filtros.pagina
  const desde = (pagina - 1) * filtros.limite
  const cuantas = Math.max(0, Math.min(filtros.limite, total - desde))
  return {
    items: Array.from({ length: cuantas }, (_, i) => cita(desde + i + 1)),
    total,
    pagina,
    limite: filtros.limite,
  }
}

const Ubicacion = () => {
  const { search } = useLocation()
  return <output data-testid="ubicacion">{search}</output>
}

const montar = (ruta = '/admin/citas') => {
  const router = createMemoryRouter(
    [
      {
        path: '/admin/citas',
        element: (
          <>
            <Citas />
            <Ubicacion />
          </>
        ),
      },
    ],
    { initialEntries: [ruta] }
  )
  render(<RouterProvider router={router} />)
  return router
}

const url = () => screen.getByTestId('ubicacion').textContent
const parametros = () => new URLSearchParams(url())
const ultimaConsulta = () => vi.mocked(api.obtenerCitasAdmin).mock.calls.at(-1)[1]
const nav = () => screen.getByRole('navigation', { name: 'Paginación' })

beforeEach(() => {
  vi.mocked(api.obtenerCitasAdmin).mockImplementation(respuestaPaginada())
  vi.mocked(api.obtenerBarberos).mockResolvedValue([
    { id: 1, nombre: 'Leo' },
    { id: 2, nombre: 'Dani' },
  ])
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  delete Element.prototype.scrollIntoView
  vi.restoreAllMocks()
})

describe('/admin/citas: página inicial', () => {
  it('pide 15 por página, pestaña "todas", y muestra el rango y el total', async () => {
    montar()

    expect(await screen.findByText('Mostrando 1–15 de 435')).toBeInTheDocument()
    expect(api.obtenerCitasAdmin).toHaveBeenCalledWith('tok', {
      pestana: 'todas', q: '', desde: '', hasta: '', barbero: '', pagina: 1, limite: 15,
    })
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Leo').length).toBeGreaterThan(0)
  })

  it('ya no tiene el bloque "Resumen" (citas por estado y por barbero)', async () => {
    montar()
    await screen.findByText('Mostrando 1–15 de 435')

    expect(screen.queryByText('Citas por estado')).toBeNull()
    expect(screen.queryByText('Citas por barbero')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Resumen' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Citas' })).toBeInTheDocument()
  })

  it('mantiene el filtro por barbero con los barberos activos', async () => {
    montar()
    await screen.findByText('Mostrando 1–15 de 435')

    const select = screen.getByLabelText('Barbero')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos los barberos', 'Leo', 'Dani'])
  })
})

describe('/admin/citas: paginación', () => {
  it('la barra tiene nav "Paginación", la actual con aria-current y "Anterior" deshabilitado en la primera', async () => {
    montar()
    await screen.findByText('Mostrando 1–15 de 435')

    expect(within(nav()).getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(within(nav()).getByRole('button', { name: 'Siguiente' })).toBeEnabled()
    expect(within(nav()).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav()).getByRole('button', { name: 'Página 2' })).not.toHaveAttribute('aria-current')
  })

  it('con muchas páginas usa puntos suspensivos: 1 … 4 5 6 … 29 con la actual en dorado', async () => {
    montar('/admin/citas?pagina=5')
    await screen.findByText('Mostrando 61–75 de 435')

    const botones = within(nav()).getAllByRole('button').map((b) => b.textContent)
    expect(botones).toEqual(['Anterior', '1', '4', '5', '6', '29', 'Siguiente'])
    expect(nav().querySelectorAll('[aria-hidden="true"]')).toHaveLength(2) // dos "…"
    const actual = within(nav()).getByRole('button', { name: 'Página 5' })
    expect(actual).toHaveAttribute('aria-current', 'page')
    expect(actual).toHaveClass('bg-oro')
    expect(within(nav()).getByText('Página 5 de 29')).toBeInTheDocument() // versión compacta de móvil
  })

  it('los controles son táctiles (mínimo 44 px) y se usan con el teclado', async () => {
    montar()
    await screen.findByText('Mostrando 1–15 de 435')

    for (const boton of within(nav()).getAllByRole('button')) {
      expect(boton).toHaveClass('min-h-11', 'min-w-11')
    }
    // Tab llega a Siguiente (Anterior está deshabilitado) y Enter avanza
    const siguiente = within(nav()).getByRole('button', { name: 'Siguiente' })
    siguiente.focus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Mostrando 16–30 de 435')).toBeInTheDocument()
  })

  it('Siguiente, Anterior y un número cambian de página, la guardan en la URL y piden esa página', async () => {
    montar()
    await screen.findByText('Mostrando 1–15 de 435')

    await userEvent.click(within(nav()).getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Mostrando 16–30 de 435')).toBeInTheDocument()
    expect(parametros().get('pagina')).toBe('2')
    expect(ultimaConsulta().pagina).toBe(2)

    await userEvent.click(within(nav()).getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByText('Mostrando 1–15 de 435')).toBeInTheDocument()
    expect(parametros().has('pagina')).toBe(false) // la página 1 no ensucia la URL

    await userEvent.click(within(nav()).getByRole('button', { name: 'Página 29' }))
    expect(await screen.findByText('Mostrando 421–435 de 435')).toBeInTheDocument()
    expect(within(nav()).getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('al cambiar de página la vista vuelve al inicio de la tabla', async () => {
    montar()
    await screen.findByText('Mostrando 1–15 de 435')
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()

    await userEvent.click(within(nav()).getByRole('button', { name: 'Siguiente' }))

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('una sola página: no hay barra, solo el texto "Mostrando"', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockImplementation(respuestaPaginada(7))
    montar()

    expect(await screen.findByText('Mostrando 1–7 de 7')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull()
  })
})

describe('/admin/citas: la URL es la fuente de verdad', () => {
  it('lee pestaña, búsqueda, fechas, barbero y página de la URL (F5 / enlace compartido)', async () => {
    montar('/admin/citas?pestana=proximas&q=ana&desde=2026-10-01&hasta=2026-10-05&barbero=2&pagina=3')
    await screen.findByText('Mostrando 31–45 de 435')

    expect(ultimaConsulta()).toEqual({
      pestana: 'proximas', q: 'ana', desde: '2026-10-01', hasta: '2026-10-05', barbero: '2', pagina: 3, limite: 15,
    })
    expect(screen.getByRole('button', { name: 'Próximas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Buscar')).toHaveValue('ana')
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-10-05')
    await waitFor(() => expect(screen.getByLabelText('Barbero')).toHaveValue('2'))
  })

  it('ignora valores inválidos de la URL en vez de romper', async () => {
    montar('/admin/citas?pestana=zzz&pagina=abc&desde=2026-02-31&hasta=hoy&barbero=-3&q=')
    await screen.findByText('Mostrando 1–15 de 435')

    expect(ultimaConsulta()).toEqual({
      pestana: 'todas', q: '', desde: '', hasta: '', barbero: '', pagina: 1, limite: 15,
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([['0'], ['-2'], ['1.5'], ['9999999']])('la página "%s" en la URL se trata como la 1', async (pagina) => {
    montar(`/admin/citas?pagina=${pagina}`)
    await screen.findByText('Mostrando 1–15 de 435')
    expect(ultimaConsulta().pagina).toBe(1)
  })

  it('atrás y adelante del navegador recuperan la página', async () => {
    const router = montar()
    await screen.findByText('Mostrando 1–15 de 435')
    await userEvent.click(within(nav()).getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('Mostrando 16–30 de 435')

    await router.navigate(-1)
    expect(await screen.findByText('Mostrando 1–15 de 435')).toBeInTheDocument()

    await router.navigate(1)
    expect(await screen.findByText('Mostrando 16–30 de 435')).toBeInTheDocument()
  })

  it('una página que no existe lleva a la última válida', async () => {
    montar('/admin/citas?pagina=99')

    expect(await screen.findByText('Mostrando 421–435 de 435')).toBeInTheDocument()
    expect(parametros().get('pagina')).toBe('29')
  })

  it('si no hay resultados, una página mayor que 1 vuelve a la 1', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockImplementation(respuestaPaginada(0))
    montar('/admin/citas?pagina=4')

    expect(await screen.findByText('Todavía no hay citas registradas.')).toBeInTheDocument()
    await waitFor(() => expect(parametros().has('pagina')).toBe(false))
  })
})

describe('/admin/citas: los filtros reinician la página', () => {
  it('cambiar de pestaña vuelve a la página 1', async () => {
    montar('/admin/citas?pagina=5')
    await screen.findByText('Mostrando 61–75 de 435')

    await userEvent.click(screen.getByRole('button', { name: 'Canceladas' }))

    await screen.findByText('Mostrando 1–15 de 435')
    expect(parametros().get('pestana')).toBe('canceladas')
    expect(parametros().has('pagina')).toBe(false)
    expect(ultimaConsulta()).toMatchObject({ pestana: 'canceladas', pagina: 1 })
  })

  it('volver a "Todas" quita la pestaña de la URL (es la de por defecto)', async () => {
    montar('/admin/citas?pestana=proximas')
    await screen.findByText('Mostrando 1–15 de 435')

    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))

    await waitFor(() => expect(parametros().has('pestana')).toBe(false))
  })

  it('el barbero y las fechas reinician la página', async () => {
    montar('/admin/citas?pagina=5')
    await screen.findByText('Mostrando 61–75 de 435')

    await userEvent.selectOptions(screen.getByLabelText('Barbero'), '2')
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ barbero: '2', pagina: 1 }))
    expect(parametros().has('pagina')).toBe(false)

    await userEvent.click(within(nav()).getByRole('button', { name: 'Página 3' }))
    await screen.findByText('Mostrando 31–45 de 435')
    await userEvent.type(screen.getByLabelText('Desde'), '2026-09-01')
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ desde: '2026-09-01', pagina: 1 }))
    expect(parametros().has('pagina')).toBe(false)

    await userEvent.click(within(nav()).getByRole('button', { name: 'Página 2' }))
    await screen.findByText('Mostrando 16–30 de 435')
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-05')
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ hasta: '2026-10-05', pagina: 1 }))
  })

  it('el rango de fechas limita los selectores: "desde" no pasa de "hasta" y viceversa', async () => {
    montar('/admin/citas?desde=2026-10-01&hasta=2026-10-05')
    await screen.findByText('Mostrando 1–15 de 435')

    expect(screen.getByLabelText('Desde')).toHaveAttribute('max', '2026-10-05')
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('min', '2026-10-01')
  })

  it('la búsqueda se aplica tras una pausa, vuelve a la página 1 y queda en la URL', async () => {
    montar('/admin/citas?pagina=5')
    await screen.findByText('Mostrando 61–75 de 435')
    const llamadas = vi.mocked(api.obtenerCitasAdmin).mock.calls.length

    await userEvent.type(screen.getByLabelText('Buscar'), 'ana')

    expect(vi.mocked(api.obtenerCitasAdmin).mock.calls.length).toBe(llamadas) // aún no (anti-rebote)
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ q: 'ana', pagina: 1 }))
    expect(parametros().get('q')).toBe('ana')
    expect(parametros().has('pagina')).toBe(false)
    expect(vi.mocked(api.obtenerCitasAdmin).mock.calls.length).toBe(llamadas + 1)
  })

  it('"Limpiar filtros" aparece solo con filtros y quita búsqueda, barbero y fechas (conserva la pestaña)', async () => {
    montar('/admin/citas?pestana=canceladas&q=ana&barbero=2&desde=2026-10-01&hasta=2026-10-05&pagina=2')
    await screen.findByText('Mostrando 16–30 de 435')

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => expect(url()).toBe('?pestana=canceladas'))
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  })

  it('sin filtros no se muestra "Limpiar filtros"', async () => {
    montar()
    await screen.findByText('Mostrando 1–15 de 435')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  })
})

describe('/admin/citas: estados de carga, vacío y error', () => {
  it('cargando', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockReturnValue(new Promise(() => {}))
    montar()
    expect(await screen.findByText('Cargando citas...')).toBeInTheDocument()
  })

  it('vacío sin filtros: mensaje de la pestaña, sin botón', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockImplementation(respuestaPaginada(0))
    montar('/admin/citas?pestana=canceladas')

    expect(await screen.findByText('No hay citas canceladas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  })

  it('vacío con filtros: SinResultados con "Limpiar filtros", que los quita', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockImplementation(respuestaPaginada(0))
    montar('/admin/citas?q=zzz')

    expect(await screen.findByText('No hay citas que coincidan con los filtros.')).toBeInTheDocument()
    // dos botones "Limpiar filtros": el de la barra de filtros y el del aviso
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    await waitFor(() => expect(url()).toBe(''))
  })

  it('error con "Reintentar" que vuelve a pedir la misma página', async () => {
    vi.mocked(api.obtenerCitasAdmin).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    montar('/admin/citas?pagina=2')

    const alerta = (await screen.findByText('No pudimos cargar las citas.')).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Mostrando 16–30 de 435')).toBeInTheDocument()
    expect(ultimaConsulta().pagina).toBe(2)
  })
})

describe('/admin/citas: acciones sobre una cita', () => {
  beforeEach(() => {
    vi.mocked(api.actualizarCita).mockResolvedValue({})
  })

  it('completar recarga la lista conservando la página y los filtros', async () => {
    montar('/admin/citas?pestana=proximas&q=ana&barbero=2&pagina=3')
    await screen.findByText('Mostrando 31–45 de 435')
    const antes = vi.mocked(api.obtenerCitasAdmin).mock.calls.length

    await userEvent.click(screen.getAllByRole('button', { name: 'Completar' })[0])

    expect(api.actualizarCita).toHaveBeenCalledWith('tok', 31, { estado: 'completada' })
    await waitFor(() => expect(vi.mocked(api.obtenerCitasAdmin).mock.calls.length).toBe(antes + 1))
    expect(ultimaConsulta()).toEqual({
      pestana: 'proximas', q: 'ana', desde: '', hasta: '', barbero: '2', pagina: 3, limite: 15,
    })
    expect(parametros().get('pagina')).toBe('3')
  })

  it('cancelar pide confirmación; si se acepta, cancela y recarga; si no, no hace nada', async () => {
    const confirmar = vi.spyOn(window, 'confirm')
    montar()
    await screen.findByText('Mostrando 1–15 de 435')

    confirmar.mockReturnValueOnce(false)
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])
    expect(api.actualizarCita).not.toHaveBeenCalled()

    confirmar.mockReturnValueOnce(true)
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])
    expect(api.actualizarCita).toHaveBeenCalledWith('tok', 1, { estado: 'cancelada' })
  })

  it('reasignar cambia el barbero de la cita y recarga la lista', async () => {
    montar('/admin/citas?pagina=2')
    await screen.findByText('Mostrando 16–30 de 435')
    const antes = vi.mocked(api.obtenerCitasAdmin).mock.calls.length

    await userEvent.selectOptions(screen.getAllByLabelText(/Reasignar barbero de la cita de Cliente 16/)[0], '2')

    expect(api.actualizarCita).toHaveBeenCalledWith('tok', 16, { barbero_id: 2 })
    await waitFor(() => expect(vi.mocked(api.obtenerCitasAdmin).mock.calls.length).toBe(antes + 1))
    expect(ultimaConsulta().pagina).toBe(2)
  })

  it('si el back-end rechaza (por ejemplo completar una cita futura) muestra el mensaje y no recarga', async () => {
    vi.mocked(api.actualizarCita).mockRejectedValue(new Error('No se puede completar una cita de una fecha futura'))
    montar()
    await screen.findByText('Mostrando 1–15 de 435')
    const antes = vi.mocked(api.obtenerCitasAdmin).mock.calls.length

    await userEvent.click(screen.getAllByRole('button', { name: 'Completar' })[0])

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede completar una cita de una fecha futura')
    expect(vi.mocked(api.obtenerCitasAdmin).mock.calls.length).toBe(antes)
  })

  it('si al cancelar se vacía la última página, la lista pasa a la última válida', async () => {
    let total = 16 // 2 páginas: la segunda tiene 1 cita
    vi.mocked(api.obtenerCitasAdmin).mockImplementation((t, f) => respuestaPaginada(total)(t, f))
    montar('/admin/citas?pagina=2')
    await screen.findByText('Mostrando 16–16 de 16')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    total = 15

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])

    expect(await screen.findByText('Mostrando 1–15 de 15')).toBeInTheDocument()
    expect(parametros().has('pagina')).toBe(false)
  })
})
