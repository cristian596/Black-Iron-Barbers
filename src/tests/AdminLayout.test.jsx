import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import * as api from '../services/api'

vi.mock('../services/api')

// Las páginas del admin se cargan con React.lazy: margen de espera para la suite completa.
const ESPERA_CARGA = 10_000
const ESPERA_TEST = 20_000

const SECCIONES = [
  ['/admin', 'Resumen'],
  ['/admin/citas', 'Citas'],
  ['/admin/servicios', 'Servicios'],
  ['/admin/empleados', 'Empleados'],
  ['/admin/reportes', 'Reportes'],
]

const sesion = (rol, usuario) => {
  const payload = { id: 1, rol, barbero_id: rol === 'barbero' ? 2 : null, exp: Math.floor(Date.now() / 1000) + 3600 }
  if (usuario) payload.usuario = usuario
  localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
}

const fijarEscritorio = (esEscritorio) => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: esEscritorio,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const montar = (ruta = '/admin') => {
  const router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
  return router
}

const lateral = () => screen.getByLabelText('Menú de navegación')
const esperarLayout = () => screen.findByRole('navigation', { name: 'Secciones del panel' }, { timeout: ESPERA_CARGA })

beforeEach(() => {
  localStorage.clear()
  sesion('admin')
  fijarEscritorio(true)
  vi.mocked(api.obtenerBarberos).mockResolvedValue([])
  vi.mocked(api.obtenerEmpleados).mockResolvedValue([])
  vi.mocked(api.obtenerReporteDiario).mockResolvedValue({
    fecha: '2026-10-04', total_cortes: 0, ingresos: 0, ticket_promedio: 0, canceladas: 0, pendientes_sin_cerrar: 0, servicios_mas_pedidos: [],
  })
  // El Resumen carga estadísticas y citas recientes al abrirse
  const periodo = { clave: 'hoy', desde: '2026-10-04', hasta: '2026-10-04' }
  const ceros = { citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 }
  vi.mocked(api.obtenerEstadisticas).mockResolvedValue({
    periodo,
    anterior: { desde: '2026-10-03', hasta: '2026-10-03' },
    actual: ceros,
    previo: ceros,
  })
  vi.mocked(api.obtenerIngresos).mockResolvedValue({ agrupar: 'dia', puntos: [], anteriores: [] })
  vi.mocked(api.obtenerServiciosTop).mockResolvedValue({ periodo, servicios: [] })
  vi.mocked(api.obtenerCitasAdmin).mockResolvedValue({ items: [], total: 0, pagina: 1, limite: 10 })
  vi.mocked(api.obtenerServiciosAdmin).mockResolvedValue([])
  vi.mocked(api.obtenerCategoriasAdmin).mockResolvedValue([])
})

afterEach(() => {
  delete window.matchMedia
})

describe('AdminLayout: estructura y rutas hijas', () => {
  it.each(SECCIONES)('%s muestra su título y marca la sección activa', async (ruta, titulo) => {
    montar(ruta)
    const nav = within(await esperarLayout())

    expect(await screen.findByRole('heading', { level: 1, name: titulo }, { timeout: ESPERA_CARGA })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(nav.getByRole('link', { name: titulo })).toHaveAttribute('aria-current', 'page')
    expect(nav.getAllByRole('link').filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1)
  }, ESPERA_TEST)

  it('la barra lateral lista las cinco secciones más Configuración y Cerrar sesión; no hay sección de clientes', async () => {
    montar('/admin')
    const nav = within(await esperarLayout())

    expect(nav.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual(
      [...SECCIONES, ['/admin/configuracion', 'Configuración']].map(([ruta, titulo]) => [titulo, ruta])
    )
    expect(within(lateral()).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.queryByText(/clientes/i)).toBeNull()
  }, ESPERA_TEST)

  it('una ruta desconocida bajo /admin vuelve al resumen', async () => {
    const router = montar('/admin/no-existe')
    await esperarLayout()
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))
  }, ESPERA_TEST)

  it('un barbero no entra a /admin: lo envía a /panel', async () => {
    localStorage.clear()
    sesion('barbero')
    const router = montar('/admin/servicios')
    await waitFor(() => expect(router.state.location.pathname).toBe('/panel'), { timeout: ESPERA_CARGA })
  }, ESPERA_TEST)

  it('Cerrar sesión pide confirmación; al confirmar borra el token y lleva a /acceso', async () => {
    const router = montar('/admin')
    await esperarLayout()
    await userEvent.click(within(lateral()).getByRole('button', { name: 'Cerrar sesión' }))
    expect(localStorage.getItem('token')).not.toBeNull()
    await userEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Cerrar sesión' }))

    expect(localStorage.getItem('token')).toBeNull()
    await waitFor(() => expect(router.state.location.pathname).toBe('/acceso'))
  }, ESPERA_TEST)

  it('al imprimir se ocultan la barra lateral y la barra superior, y la página queda en blanco y negro (print:)', async () => {
    montar('/admin/reportes')
    await esperarLayout()
    await screen.findByRole('heading', { level: 1, name: 'Reportes' }, { timeout: ESPERA_CARGA })

    expect(lateral()).toHaveClass('print:hidden')
    const barraSuperior = screen.getAllByRole('banner').find((h) => h.classList.contains('sticky'))
    expect(barraSuperior).toHaveClass('print:hidden')
    expect(lateral().parentElement).toHaveClass('print:block', 'print:bg-white', 'print:text-black')
    expect(screen.getByRole('main')).toHaveClass('print:p-0')
  }, ESPERA_TEST)

  it('la meta noindex está presente en el layout', async () => {
    montar('/admin')
    await esperarLayout()
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  }, ESPERA_TEST)
})

describe('AdminLayout: nombre del usuario', () => {
  it('muestra el nombre que viene en el token', async () => {
    localStorage.clear()
    sesion('admin', 'camilo')
    montar('/admin')
    await esperarLayout()

    expect(screen.getByRole('button', { name: 'Menú de usuario de camilo' })).toBeInTheDocument()
    expect(screen.getByText('CA')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('con un token anterior sin nombre usa el respaldo "Administrador"', async () => {
    montar('/admin')
    await esperarLayout()

    expect(screen.getByRole('button', { name: 'Menú de usuario de Administrador' })).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('AdminLayout: escritorio', () => {
  it('la barra lateral es visible y no actúa como diálogo', async () => {
    montar('/admin')
    await esperarLayout()

    expect(lateral()).not.toHaveAttribute('inert')
    expect(screen.queryByRole('dialog')).toBeNull()
  }, ESPERA_TEST)
})

describe('AdminLayout: menú móvil', () => {
  beforeEach(() => fijarEscritorio(false))

  it('cerrado queda inert; al abrir se vuelve diálogo con el foco dentro', async () => {
    montar('/admin')
    await esperarLayout()
    const abrir = screen.getByRole('button', { name: 'Abrir menú' })

    expect(lateral()).toHaveAttribute('inert')
    expect(abrir).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(abrir)

    const dialogo = screen.getByRole('dialog', { name: 'Menú de navegación' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).not.toHaveAttribute('inert')
    expect(abrir).toHaveAttribute('aria-expanded', 'true')
    expect(dialogo).toContainElement(document.activeElement)
    // El resto de la página queda inerte mientras el cajón está abierto
    expect(screen.getByRole('main').parentElement).toHaveAttribute('inert')
  }, ESPERA_TEST)

  it('Escape lo cierra y el foco vuelve al botón que lo abrió', async () => {
    montar('/admin')
    await esperarLayout()
    const abrir = screen.getByRole('button', { name: 'Abrir menú' })
    await userEvent.click(abrir)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Menú de navegación' })).toBeNull()
    expect(lateral()).toHaveAttribute('inert')
    expect(abrir).toHaveFocus()
  }, ESPERA_TEST)

  it('el foco queda atrapado: Tab desde el último elemento vuelve al primero y Shift+Tab al revés', async () => {
    montar('/admin')
    await esperarLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

    const dialogo = screen.getByRole('dialog', { name: 'Menú de navegación' })
    const cerrarMenu = within(dialogo).getByRole('button', { name: 'Cerrar menú' })
    const cerrarSesion = within(dialogo).getByRole('button', { name: 'Cerrar sesión' })

    expect(cerrarMenu).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(cerrarSesion).toHaveFocus()
    await userEvent.tab()
    expect(cerrarMenu).toHaveFocus()
  }, ESPERA_TEST)

  it('el botón Cerrar menú y el clic en el fondo lo cierran', async () => {
    montar('/admin')
    await esperarLayout()
    const abrir = screen.getByRole('button', { name: 'Abrir menú' })

    await userEvent.click(abrir)
    await userEvent.click(within(lateral()).getByRole('button', { name: 'Cerrar menú' }))
    expect(lateral()).toHaveAttribute('inert')

    await userEvent.click(abrir)
    await userEvent.click(document.querySelector('[aria-hidden="true"].fixed.inset-0'))
    expect(lateral()).toHaveAttribute('inert')
  }, ESPERA_TEST)

  it('al navegar desde el menú se cierra solo', async () => {
    const router = montar('/admin')
    await esperarLayout()
    const abrir = screen.getByRole('button', { name: 'Abrir menú' })
    await userEvent.click(abrir)

    await userEvent.click(within(lateral()).getByRole('link', { name: 'Servicios' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/servicios'))
    expect(lateral()).toHaveAttribute('inert')
    expect(abrir).toHaveAttribute('aria-expanded', 'false')
    expect(await screen.findByRole('heading', { level: 1, name: 'Servicios' }, { timeout: ESPERA_CARGA })).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('AdminLayout: barra superior', () => {
  it('el buscador es global: lleva a /admin/citas?q= con el texto codificado', async () => {
    const router = montar('/admin/servicios')
    await esperarLayout()

    await userEvent.type(screen.getByRole('searchbox', { name: /Buscar citas/ }), 'Ñandú & Pérez{Enter}')

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/citas'))
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('Ñandú & Pérez')
  }, ESPERA_TEST)

  it('un buscador vacío lleva a /admin/citas sin q', async () => {
    const router = montar('/admin')
    await esperarLayout()

    await userEvent.type(screen.getByRole('searchbox', { name: /Buscar citas/ }), '   {Enter}')

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/citas'))
    expect(router.state.location.search).toBe('')
  }, ESPERA_TEST)

  it('el menú de usuario abre Cambiar contraseña en un diálogo y Escape devuelve el foco', async () => {
    montar('/admin')
    await esperarLayout()
    const boton = screen.getByRole('button', { name: /Menú de usuario/ })
    expect(boton).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    const dialogo = screen.getByRole('dialog', { name: 'Cambiar contraseña' })
    expect(within(dialogo).getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(dialogo).toContainElement(document.activeElement)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(boton).toHaveFocus()
  }, ESPERA_TEST)

  it('Escape y el clic fuera cierran el menú de usuario', async () => {
    montar('/admin')
    await esperarLayout()
    const boton = screen.getByRole('button', { name: /Menú de usuario/ })

    await userEvent.click(boton)
    await userEvent.keyboard('{Escape}')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton).toHaveFocus()

    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('main'))
    expect(boton).toHaveAttribute('aria-expanded', 'false')
  }, ESPERA_TEST)

  it('el diálogo cambia la contraseña con la API', async () => {
    vi.mocked(api.cambiarContrasena).mockResolvedValue({})
    montar('/admin')
    await esperarLayout()
    await userEvent.click(screen.getByRole('button', { name: /Menú de usuario/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'actual123')
    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'nueva12345')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'nueva12345')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(api.cambiarContrasena).toHaveBeenCalledWith(expect.any(String), 'actual123', 'nueva12345')
    expect(await screen.findByText('Contraseña actualizada correctamente')).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('AdminLayout: confirmación al cerrar sesión', () => {
  it('Cancelar y Escape no cierran la sesión y devuelven el foco al botón; el foco inicial está en Cancelar', async () => {
    montar('/admin')
    await esperarLayout()
    const boton = within(lateral()).getByRole('button', { name: 'Cerrar sesión' })

    await userEvent.click(boton)
    const dialogo = screen.getByRole('dialog', { name: '¿Cerrar sesión?' })
    expect(within(dialogo).getByText('Tendrás que volver a iniciar sesión para entrar al panel.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(boton).toHaveFocus()

    await userEvent.click(boton)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(boton).toHaveFocus()
    expect(localStorage.getItem('token')).not.toBeNull()
  }, ESPERA_TEST)

  it('en el cajón móvil el diálogo no cierra el cajón al cancelar y confirmar cierra la sesión', async () => {
    fijarEscritorio(false)
    const router = montar('/admin')
    await esperarLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const boton = within(screen.getByRole('dialog', { name: 'Menú de navegación' })).getByRole('button', { name: 'Cerrar sesión' })

    await userEvent.click(boton)
    await userEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('dialog', { name: 'Menú de navegación' })).toBeInTheDocument()
    expect(boton).toHaveFocus()

    await userEvent.click(boton)
    await userEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/acceso'))
    expect(localStorage.getItem('token')).toBeNull()
  }, ESPERA_TEST)
})

describe('AdminLayout: Cerrar sesión desde el menú de usuario', () => {
  const abrirMenu = async () => {
    const avatar = screen.getByRole('button', { name: /Menú de usuario/ })
    await userEvent.click(avatar)
    return avatar
  }

  it('el menú ofrece Cambiar contraseña y Cerrar sesión, ambos de al menos 44 px (min-h-11)', async () => {
    montar('/admin')
    await esperarLayout()
    await abrirMenu()
    const menu = document.getElementById('menu-usuario')

    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cambiar contraseña', 'Cerrar sesión'])
    within(menu).getAllByRole('button').forEach((b) => expect(b).toHaveClass('min-h-11'))
  }, ESPERA_TEST)

  it('Cerrar sesión cierra el menú, abre el diálogo con foco en Cancelar y no cierra la sesión', async () => {
    montar('/admin')
    await esperarLayout()
    const avatar = await abrirMenu()
    await userEvent.click(within(document.getElementById('menu-usuario')).getByRole('button', { name: 'Cerrar sesión' }))

    const dialogo = screen.getByRole('dialog', { name: '¿Cerrar sesión?' })
    expect(document.getElementById('menu-usuario')).toBeNull()
    expect(avatar).toHaveAttribute('aria-expanded', 'false')
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(localStorage.getItem('token')).not.toBeNull()
  }, ESPERA_TEST)

  it('Cancelar y Escape devuelven el foco al avatar', async () => {
    montar('/admin')
    await esperarLayout()
    const avatar = await abrirMenu()
    await userEvent.click(within(document.getElementById('menu-usuario')).getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(avatar).toHaveFocus()

    await abrirMenu()
    await userEvent.click(within(document.getElementById('menu-usuario')).getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(avatar).toHaveFocus()
    expect(localStorage.getItem('token')).not.toBeNull()
  }, ESPERA_TEST)

  it('confirmar cierra la sesión y lleva a /acceso sin el aviso de sesión expirada', async () => {
    const router = montar('/admin')
    await esperarLayout()
    await abrirMenu()
    await userEvent.click(within(document.getElementById('menu-usuario')).getByRole('button', { name: 'Cerrar sesión' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).getByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/acceso'))
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.queryByText(/Tu sesión expiró/)).toBeNull()
  }, ESPERA_TEST)
})
