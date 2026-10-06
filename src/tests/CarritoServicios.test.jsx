import { useEffect } from 'react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CarritoServicios from '../components/carrito/CarritoServicios'
import CatalogoServicios from '../components/sections/CatalogoServicios'
import { ProveedorCarrito, useCarrito } from '../context/CarritoContext'
import * as api from '../services/api'
import { SERVICIOS_API, SERVICIO_GRATIS } from './fixturesServicios'

vi.mock('../services/api')

const CLAVE = 'seleccion-servicios'
const CATALOGO = [...SERVICIOS_API, SERVICIO_GRATIS]

// Sincroniza el carrito con el catálogo, como hace la carta al cargar.
const Sincronizar = () => {
  const { sincronizar } = useCarrito()
  useEffect(() => sincronizar(CATALOGO), [sincronizar])
  return null
}

const montar = (ids = []) => {
  if (ids.length) sessionStorage.setItem(CLAVE, JSON.stringify(ids))
  return render(
    <MemoryRouter>
      <ProveedorCarrito>
        <Sincronizar />
        <CarritoServicios />
      </ProveedorCarrito>
    </MemoryRouter>
  )
}

const aside = () => screen.getByRole('complementary', { name: 'Tu selección' })
const barra = () => screen.getByRole('region', { name: 'Resumen de tu selección' })

beforeEach(() => {
  sessionStorage.clear()
  document.body.className = ''
  vi.mocked(api.obtenerServicios).mockReset()
  vi.mocked(api.obtenerServicios).mockResolvedValue(CATALOGO)
})

describe('Carrito "Tu selección": escritorio (aside)', () => {
  it('vacío: frase de ayuda, sin botón de agendar ni barra móvil', () => {
    montar()

    expect(within(aside()).getByRole('heading', { name: 'Tu selección' })).toBeInTheDocument()
    expect(within(aside()).getByText(/Aún no has elegido servicios/)).toBeInTheDocument()
    expect(within(aside()).queryByRole('link', { name: /Agendar/ })).not.toBeInTheDocument()
    expect(within(aside()).queryByRole('button', { name: 'Vaciar selección' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Resumen de tu selección' })).not.toBeInTheDocument()
    expect(within(aside()).getByText('Agenda ahora y paga en sitio')).toBeInTheDocument()
  })

  it('lista nombre, duración y precio; suma el tiempo total y el total', async () => {
    montar([1, 2])

    expect(await within(aside()).findByText('Corte clásico')).toBeInTheDocument()
    expect(within(aside()).getByText('Corte degradado (Fade)')).toBeInTheDocument()
    expect(within(aside()).getByText('30 min')).toBeInTheDocument()
    expect(within(aside()).getByText('$18.000')).toBeInTheDocument()
    expect(within(aside()).getByText('1 h 10 min')).toBeInTheDocument()
    expect(within(aside()).getByText('$43.000')).toBeInTheDocument()
    expect(within(aside()).getByText('2 servicios de 3')).toBeInTheDocument()
  })

  it('el botón principal usa singular y plural y enlaza con los ids EN ORDEN', async () => {
    montar([3, 1])
    const plural = await within(aside()).findByRole('link', { name: 'Agendar 2 servicios' })
    expect(plural).toHaveAttribute('href', '/reservar-corte?servicios=3,1')
  })

  it('con un solo servicio dice "Agendar 1 servicio"', async () => {
    montar([5])
    const singular = await within(aside()).findByRole('link', { name: 'Agendar 1 servicio' })
    expect(singular).toHaveAttribute('href', '/reservar-corte?servicios=5')
  })

  it('si el total es 0 muestra "Gratis" (sin "desde")', async () => {
    montar([7])
    await within(aside()).findByText('Asesoría gratuita')
    const total = within(aside()).getByText('Total').parentElement
    expect(total).toHaveTextContent('Gratis')
    expect(aside()).not.toHaveTextContent(/desde/i)
  })

  it('"Quitar" saca un servicio y "Vaciar selección" los quita todos', async () => {
    const user = userEvent.setup()
    montar([1, 2, 4])
    await within(aside()).findByText('Perfilado de barba')

    await user.click(within(aside()).getByRole('button', { name: 'Quitar Corte clásico de mi selección' }))
    expect(within(aside()).queryByText('Corte clásico')).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(CLAVE))).toEqual([2, 4])

    await user.click(within(aside()).getByRole('button', { name: 'Vaciar selección' }))
    expect(within(aside()).getByText(/Aún no has elegido servicios/)).toBeInTheDocument()
    expect(sessionStorage.getItem(CLAVE)).toBeNull()
  })

  it('avisa (sin bloquear) cuando hay dos servicios de la misma categoría', async () => {
    montar([1, 2])
    await within(aside()).findByText('Corte clásico')
    expect(within(aside()).getByText('Ya tienes un servicio de Cortes; puedes continuar si quieres ambos.')).toBeInTheDocument()
    expect(within(aside()).getByRole('link', { name: 'Agendar 2 servicios' })).toBeInTheDocument()

  })

  it('los controles táctiles miden al menos 44 px (clases size-11 / min-h-11)', async () => {
    montar([1, 2])
    await within(aside()).findByText('Corte clásico')
    const controles = [
      ...within(aside()).getAllByRole('button'),
      within(aside()).getByRole('link', { name: /Agendar/ }),
    ]
    controles.forEach((control) => expect(control.className).toMatch(/size-11|min-h-11/))
  })

  it('el contador y el total están en una región aria-live que siempre existe (solo cambia el texto)', async () => {
    montar()
    const estado = within(aside()).getByText('0 de 3 servicios').parentElement
    expect(estado).toHaveAttribute('role', 'status')
    expect(estado).toHaveAttribute('aria-live', 'polite')
  })

  it('no tiene la palabra "desde" ni precios inventados: el total es la suma exacta', async () => {
    montar([1, 2, 3])
    await within(aside()).findByText('Corte clásico')
    expect(within(aside()).getByText('$83.000')).toBeInTheDocument() // 18.000 + 25.000 + 40.000
  })
})

describe('Carrito "Tu selección": móvil (barra inferior y panel)', () => {
  it('la barra muestra el contador y el total y lleva a agendar con los ids', async () => {
    montar([1, 2])

    const b = await screen.findByRole('region', { name: 'Resumen de tu selección' })
    expect(within(b).getByRole('button', { name: /Tu selección · 2 servicios/ })).toBeInTheDocument()
    expect(within(b).getByText('$43.000')).toBeInTheDocument()
    expect(within(b).getByRole('link', { name: 'Agendar' })).toHaveAttribute('href', '/reservar-corte?servicios=1,2')
    expect(within(b).getByRole('status')).toHaveTextContent('2 servicios en tu selección. Total $43.000.')
    // z-index: bajo el botón de WhatsApp y el de Inicio (z-50) y con alto fijo de 4 rem
    expect(b).toHaveClass('z-40', 'h-16', 'lg:hidden')
  })

  it('al tocar la barra abre el panel (dialog) con la lista y revalida contra el catálogo', async () => {
    const user = userEvent.setup()
    montar([1, 2])
    await screen.findByRole('region', { name: 'Resumen de tu selección' })
    expect(api.obtenerServicios).not.toHaveBeenCalled()

    await user.click(within(barra()).getByRole('button', { name: /Tu selección/ }))

    const panel = await screen.findByRole('dialog', { name: 'Tu selección' })
    expect(panel).toHaveAttribute('aria-modal', 'true')
    expect(within(panel).getByText('Corte degradado (Fade)')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Agendar 2 servicios' })).toHaveAttribute('href', '/reservar-corte?servicios=1,2')
    expect(api.obtenerServicios).toHaveBeenCalledTimes(1)
    expect(panel).toHaveClass('max-h-[85dvh]', 'overflow-y-auto')
    expect(panel.parentElement).toHaveClass('z-55', 'lg:hidden')
  })

  it('foco: entra al panel, el fondo no hace scroll, Escape cierra y el foco vuelve al botón que lo abrió', async () => {
    const user = userEvent.setup()
    montar([1, 2])
    const abrir = within(await screen.findByRole('region', { name: 'Resumen de tu selección' })).getByRole('button', { name: /Tu selección/ })
    abrir.focus()

    await user.click(abrir)
    const panel = await screen.findByRole('dialog', { name: 'Tu selección' })
    expect(panel).toContainElement(document.activeElement)
    expect(document.body).toHaveClass('overflow-hidden')
    expect(abrir).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('overflow-hidden')
    expect(abrir).toHaveFocus()
    expect(abrir).toHaveAttribute('aria-expanded', 'false')
  })

  it('Tab no se sale del panel (el foco da la vuelta)', async () => {
    const user = userEvent.setup()
    montar([1])
    await user.click(within(await screen.findByRole('region', { name: 'Resumen de tu selección' })).getByRole('button', { name: /Tu selección/ }))
    const panel = await screen.findByRole('dialog', { name: 'Tu selección' })

    for (let i = 0; i < 8; i += 1) {
      await user.tab()
      expect(panel).toContainElement(document.activeElement)
    }
  })

  it('el botón "Cerrar" del panel (44 px) lo cierra', async () => {
    const user = userEvent.setup()
    montar([1])
    await user.click(within(await screen.findByRole('region', { name: 'Resumen de tu selección' })).getByRole('button', { name: /Tu selección/ }))
    const cerrar = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cerrar tu selección' })
    expect(cerrar).toHaveClass('size-11')

    await user.click(cerrar)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('al abrir, un servicio que ya no está activo se quita con un aviso dentro del panel', async () => {
    const user = userEvent.setup()
    montar([1, 2])
    await user.click(within(await screen.findByRole('region', { name: 'Resumen de tu selección' })).getByRole('button', { name: /Tu selección/ }))
    // el catálogo ya no incluye el servicio 2
    vi.mocked(api.obtenerServicios).mockResolvedValue(CATALOGO.filter((s) => s.id !== 2))
    await user.keyboard('{Escape}')
    await user.click(within(barra()).getByRole('button', { name: /Tu selección/ }))

    const panel = await screen.findByRole('dialog', { name: 'Tu selección' })
    expect(await within(panel).findByText(/"Corte degradado \(Fade\)" ya no está disponible/)).toBeInTheDocument()
    expect(within(panel).queryByText('Corte degradado (Fade)', { selector: 'p' })).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(CLAVE))).toEqual([1])
  })

  it('quitar el último servicio dentro del panel lo cierra', async () => {
    const user = userEvent.setup()
    montar([1])
    await user.click(within(await screen.findByRole('region', { name: 'Resumen de tu selección' })).getByRole('button', { name: /Tu selección/ }))
    const panel = await screen.findByRole('dialog')
    await user.click(within(panel).getByRole('button', { name: 'Quitar Corte clásico de mi selección' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Resumen de tu selección' })).not.toBeInTheDocument()
  })
})

describe('Carta + carrito (integración)', () => {
  const montarCarta = async () => {
    render(
      <MemoryRouter>
        <ProveedorCarrito>
          <CatalogoServicios />
        </ProveedorCarrito>
      </MemoryRouter>
    )
    await screen.findByRole('group', { name: 'Filtrar servicios' })
  }

  it('al cargar la carta quita de la selección guardada lo inactivo y muestra un aviso visible (aria-live)', async () => {
    vi.mocked(api.obtenerServicios).mockResolvedValue(SERVICIOS_API)
    sessionStorage.setItem(CLAVE, JSON.stringify([1, 99]))

    await montarCarta()

    const avisos = screen.getAllByText(/ya no está disponible y lo quitamos/)
    expect(avisos.length).toBeGreaterThan(0)
    avisos.forEach((a) => expect(a.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite'))
    expect(JSON.parse(sessionStorage.getItem(CLAVE))).toEqual([1])
    expect(screen.getAllByRole('button', { name: 'Quitar de mi selección' })).toHaveLength(1)
  })

  it('agregar desde las tarjetas alimenta el carrito; el aside está a la derecha y las tarjetas pasan a 3 columnas en xl', async () => {
    const user = userEvent.setup()
    vi.mocked(api.obtenerServicios).mockResolvedValue(SERVICIOS_API)
    await montarCarta()

    const botones = screen.getAllByRole('button', { name: 'Agregar a mi selección' })
    await user.click(botones[0])
    await user.click(botones[1])

    expect(within(aside()).getByText('2 servicios de 3')).toBeInTheDocument()
    expect(within(aside()).getByRole('link', { name: 'Agendar 2 servicios' })).toHaveAttribute('href', '/reservar-corte?servicios=1,2')

    const rejilla = aside().parentElement
    expect(rejilla).toHaveClass('lg:grid-cols-[minmax(0,1fr)_20rem]')
    expect(aside()).toHaveClass('lg:sticky', 'hidden', 'lg:block')
    const columnas = screen.getByRole('heading', { name: 'Corte clásico' }).closest('section').firstElementChild
    expect(columnas.className).toContain('xl:grid-cols-3')
    expect(columnas.className).not.toContain('xl:grid-cols-4')
  })
})

// El carrito solo lo usan la carta y la reserva (el contexto y las reglas de utils/carrito.js); los paneles del barbero y
// del admin no dependen de él.
describe('Los paneles no usan el carrito', () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const archivos = (ruta) => {
    const completa = path.join(raiz, ruta)
    if (!statSync(completa).isDirectory()) return [completa]
    return readdirSync(completa).flatMap((nombre) => archivos(path.join(ruta, nombre)))
  }
  const PROHIBIDO = /CarritoContext|useCarrito|ProveedorCarrito|utils\/carrito|components\/carrito/

  it.each([
    'pages/panel',
    'pages/admin',
    'components/panel',
    'components/admin',
    'components/dashboard',
  ])('%s no importa nada del carrito', (ruta) => {
    const infractores = archivos(ruta).filter((archivo) => PROHIBIDO.test(readFileSync(archivo, 'utf-8')))
    expect(infractores).toEqual([])
  })
})
