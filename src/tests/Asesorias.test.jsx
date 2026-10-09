import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Asesorias from '../pages/Asesorias'
import { ASESORIAS } from '../data/asesorias'
import * as api from '../services/api'
import { ASESORIAS_API, PREMIUM_API } from './fixturesAsesorias'

// Precio, duración e id de cada asesoría salen de la API; aquí solo se simula su respuesta.
vi.mock('../services/api')

const Ubicacion = () => {
  const { pathname, search, hash } = useLocation()
  return <output data-testid="ubicacion">{pathname + search + hash}</output>
}

const montar = (ruta = '/asesorias') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/asesorias" element={<Asesorias />} />
        <Route path="/reservar-corte" element={<p>reserva</p>} />
      </Routes>
      <Ubicacion />
    </MemoryRouter>
  )

let llamadas
beforeEach(() => {
  llamadas = []
  Element.prototype.scrollIntoView = vi.fn(function (opciones) {
    llamadas.push({ id: this.id, opciones })
  })
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue(ASESORIAS_API)
})

afterEach(() => {
  delete Element.prototype.scrollIntoView
  delete window.matchMedia
})

describe('Página /asesorias: estructura', () => {
  it('tiene un solo h1 y un título y descripción propios que se restauran al salir', () => {
    document.title = 'Black Iron Barbers'
    const { unmount } = montar()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Asesorías de imagen' })).toBeInTheDocument()
    expect(document.title).toBe('Asesorías de imagen | Black Iron Barbers')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(/Asesoría Premium/)

    unmount()
    expect(document.title).toBe('Black Iron Barbers')
    expect(document.head.querySelector('meta[name="description"]')).toBeNull()
  })

  it('franja resumen: tres enlaces con ancla, precio (Gratis) y duración, tomados de la API', async () => {
    montar()
    const resumen = within(screen.getByRole('navigation', { name: 'Asesorías disponibles' }))

    expect(resumen.getByRole('link', { name: /Asesoría de imagen gratis/ })).toHaveAttribute('href', '/asesorias#gratis')
    expect(resumen.getByRole('link', { name: /Asesoría Premium/ })).toHaveAttribute('href', '/asesorias#premium')
    expect(resumen.getByRole('link', { name: /Asesoría de barba/ })).toHaveAttribute('href', '/asesorias#barba')
    expect(await resumen.findByText('Gratis · 15 min')).toBeInTheDocument()
    expect(resumen.getByText('$60.000 · 1 h')).toBeInTheDocument()
    expect(resumen.getByText('$45.000 · 45 min')).toBeInTheDocument()
  })

  it.each(ASESORIAS.map((a) => [a.id, a]))('sección "%s": id, h2 enfocable, bloques y tres pasos', (id, asesoria) => {
    const { container } = montar()
    const seccion = container.querySelector(`section#${id}`)

    expect(seccion).not.toBeNull()
    expect(seccion).toHaveClass('scroll-mt-24')
    const h2 = within(seccion).getByRole('heading', { level: 2, name: asesoria.titulo })
    expect(h2).toHaveAttribute('tabindex', '-1')
    expect(seccion).toHaveAttribute('aria-labelledby', h2.id)

    const dentro = within(seccion)
    expect(dentro.getByRole('heading', { level: 3, name: 'Qué incluye' })).toBeInTheDocument()
    expect(dentro.getByRole('heading', { level: 3, name: 'Para quién es' })).toBeInTheDocument()
    expect(dentro.getByRole('heading', { level: 3, name: 'Cómo funciona' })).toBeInTheDocument()
    expect(dentro.getAllByRole('heading', { level: 4 })).toHaveLength(3)
    expect(dentro.getAllByRole('listitem').length).toBeGreaterThanOrEqual(asesoria.incluye.length + 3)
  })

  it('el precio 0 se muestra como "Gratis" y no como $0', async () => {
    const { container } = montar()
    const gratis = container.querySelector('section#gratis')
    expect(await within(gratis).findByText('Gratis · 15 min')).toBeInTheDocument()
    expect(gratis.textContent).not.toMatch(/\$0/)
  })

  it('no usa fotos de personas', () => {
    const { container } = montar()
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('cierra con el enlace "Solo quiero reservar mi corte"', async () => {
    const user = userEvent.setup()
    montar()
    const enlace = screen.getByRole('link', { name: 'Solo quiero reservar mi corte' })
    expect(enlace).toHaveAttribute('href', '/reservar-corte')
    await user.click(enlace)
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/reservar-corte')
  })
})

describe('Página /asesorias: reservar en línea', () => {
  it('cada sección lleva "Reservar esta asesoría" a /reservar-corte?servicio=<id de la API> (camino rápido: no vacía el carrito)', async () => {
    const { container } = montar()
    for (const servicio of ASESORIAS_API) {
      const id = ASESORIAS.find((a) => a.clave === servicio.clave).id
      const boton = await within(container.querySelector(`section#${id}`)).findByRole('link', { name: /Reservar esta asesoría/ })
      expect(boton).toHaveAttribute('href', `/reservar-corte?servicio=${servicio.id}`)
    }
  })

  it('el botón navega a la reserva con la asesoría preseleccionada por la URL', async () => {
    const user = userEvent.setup()
    const { container } = montar()
    await user.click(await within(container.querySelector('section#premium')).findByRole('link', { name: /Reservar esta asesoría/ }))
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(`/reservar-corte?servicio=${PREMIUM_API.id}`)
  })

  it('ya no hay WhatsApp en la página: ni botones, ni enlaces wa.me, ni la nota de coordinar por WhatsApp', async () => {
    const { container } = montar()
    await screen.findAllByRole('link', { name: /Reservar esta asesoría/ })
    expect(container.querySelectorAll('a[href*="wa.me"]')).toHaveLength(0)
    expect(container.textContent).not.toMatch(/WhatsApp/i)
  })

  it('el id del enlace sale de la API, no del código: si cambia el id, cambia el enlace', async () => {
    vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue(
      ASESORIAS_API.map((s) => (s.clave === 'asesoria-barba' ? { ...s, id: 999, nombre: 'Barba renombrada' } : s))
    )
    const { container } = montar()
    const boton = await within(container.querySelector('section#barba')).findByRole('link', { name: /Reservar esta asesoría/ })
    expect(boton).toHaveAttribute('href', '/reservar-corte?servicio=999')
  })

  it('una asesoría que la API ya no trae (inactiva) no se muestra', async () => {
    vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue(ASESORIAS_API.filter((s) => s.clave !== 'asesoria-barba'))
    const { container } = montar()
    await screen.findAllByRole('link', { name: /Reservar esta asesoría/ })
    expect(container.querySelector('section#barba')).toBeNull()
    expect(container.querySelector('section#premium')).not.toBeNull()
  })
})

describe('Página /asesorias: si la API falla', () => {
  it('muestra los textos sin precios ni duraciones inventados, un aviso por sección y Reintentar', async () => {
    vi.mocked(api.obtenerServiciosAsesoria).mockRejectedValue(new Error('No se pudo conectar con el servidor'))
    const { container } = montar()

    expect(await screen.findAllByRole('alert')).toHaveLength(3)
    expect(container.querySelectorAll('section[id]')).toHaveLength(3) // los textos siguen ahí
    expect(container.textContent).not.toMatch(/\$\d|Gratis ·|\d+ min\b|\d h\b/)
    expect(screen.queryByRole('link', { name: /Reservar esta asesoría/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(3)
  })

  it('Reintentar vuelve a pedir y, si responde, aparecen los precios y los botones', async () => {
    const user = userEvent.setup()
    vi.mocked(api.obtenerServiciosAsesoria)
      .mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
      .mockResolvedValue(ASESORIAS_API)
    montar()

    await user.click((await screen.findAllByRole('button', { name: 'Reintentar' }))[0])
    expect(await screen.findAllByRole('link', { name: /Reservar esta asesoría/ })).toHaveLength(3)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('mientras carga: sin precios, sin botón de reservar y con un estado accesible', async () => {
    vi.mocked(api.obtenerServiciosAsesoria).mockReturnValue(new Promise(() => {}))
    montar()
    expect(screen.queryByRole('link', { name: /Reservar esta asesoría/ })).toBeNull()
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(3)
  })
})

describe('Página /asesorias: scroll y foco por hash', () => {
  it('al cargar con #premium hace scroll a esa sección (suave) y enfoca su h2', () => {
    montar('/asesorias#premium')

    expect(llamadas).toEqual([{ id: 'premium', opciones: { block: 'start', behavior: 'smooth' } }])
    expect(screen.getByRole('heading', { level: 2, name: 'Asesoría Premium' })).toHaveFocus()
  })

  it('con prefers-reduced-motion el scroll no es suave', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    montar('/asesorias#barba')

    expect(llamadas[0].opciones.behavior).toBe('auto')
  })

  it('con la página abierta, cambiar el hash vuelve a hacer scroll y mover el foco', async () => {
    const user = userEvent.setup()
    montar('/asesorias#gratis')
    expect(llamadas.map((l) => l.id)).toEqual(['gratis'])

    const resumen = within(screen.getByRole('navigation', { name: 'Asesorías disponibles' }))
    await user.click(resumen.getByRole('link', { name: /Asesoría de barba/ }))

    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/asesorias#barba')
    expect(llamadas.map((l) => l.id)).toEqual(['gratis', 'barba'])
    expect(screen.getByRole('heading', { level: 2, name: 'Asesoría de barba' })).toHaveFocus()
  })

  it('repetir el mismo hash también hace scroll de nuevo', async () => {
    const user = userEvent.setup()
    montar('/asesorias#premium')
    const resumen = within(screen.getByRole('navigation', { name: 'Asesorías disponibles' }))

    await user.click(resumen.getByRole('link', { name: /Asesoría Premium/ }))
    await user.click(resumen.getByRole('link', { name: /Asesoría Premium/ }))

    expect(llamadas.map((l) => l.id)).toEqual(['premium', 'premium', 'premium'])
  })

  it('un hash que no es de una asesoría no hace nada', () => {
    montar('/asesorias#cualquier-cosa')
    expect(llamadas).toHaveLength(0)
  })

  it('sin hash no hace scroll', () => {
    montar('/asesorias')
    expect(llamadas).toHaveLength(0)
  })
})

describe('Asesoría creada por el admin (sin clave)', () => {
  it('no aparece en /asesorias (solo se muestran las que tienen texto por clave) y no rompe las demás', async () => {
    vi.mocked(api.obtenerServiciosAsesoria).mockResolvedValue([
      ...ASESORIAS_API,
      { id: 500, nombre: 'Asesoría del admin', descripcion: 'x', precio: 30000, duracion_min: 30, tipo: 'original', categoria: { id: 9, nombre: 'Asesorías', slug: 'asesorias' } },
    ])
    const { container } = montar()
    await within(container.querySelector('section#premium')).findByRole('link', { name: /Reservar esta asesoría/ })
    expect(screen.queryByText('Asesoría del admin')).toBeNull()
    expect(container.querySelectorAll('section[id]')).toHaveLength(3)
  })
})
