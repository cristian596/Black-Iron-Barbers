import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Asesorias from '../pages/Asesorias'
import { ASESORIAS } from '../data/asesorias'

const Ubicacion = () => {
  const { pathname, hash } = useLocation()
  return <output data-testid="ubicacion">{pathname + hash}</output>
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
  vi.stubEnv('VITE_WHATSAPP_NUMERO', '570000000000')
})

afterEach(() => {
  delete Element.prototype.scrollIntoView
  delete window.matchMedia
  vi.unstubAllEnvs()
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

  it('franja resumen: tres enlaces con ancla, precio (Gratis) y duración', () => {
    montar()
    const resumen = within(screen.getByRole('navigation', { name: 'Asesorías disponibles' }))

    expect(resumen.getByRole('link', { name: /Asesoría de imagen gratis/ })).toHaveAttribute('href', '/asesorias#gratis')
    expect(resumen.getByRole('link', { name: /Asesoría Premium/ })).toHaveAttribute('href', '/asesorias#premium')
    expect(resumen.getByRole('link', { name: /Asesoría de barba/ })).toHaveAttribute('href', '/asesorias#barba')
    expect(resumen.getByText('Gratis · 15 min')).toBeInTheDocument()
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

  it('el precio 0 se muestra como "Gratis" y no como $0', () => {
    const { container } = montar()
    const gratis = container.querySelector('section#gratis')
    expect(within(gratis).getByText('Gratis · 15 min')).toBeInTheDocument()
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

describe('Página /asesorias: botones de WhatsApp (temporales)', () => {
  it('cada botón abre WhatsApp con un mensaje propio de su asesoría', () => {
    const { container } = montar()
    const mensajes = ASESORIAS.map(({ id, textoBoton, mensajeWhatsApp }) => {
      const boton = within(container.querySelector(`section#${id}`)).getByRole('link', { name: new RegExp(textoBoton) })
      expect(boton).toHaveAttribute('href', `https://wa.me/570000000000?text=${encodeURIComponent(mensajeWhatsApp)}`)
      expect(boton).toHaveAttribute('target', '_blank')
      expect(boton).toHaveAttribute('rel', 'noopener noreferrer')
      return mensajeWhatsApp
    })
    expect(new Set(mensajes).size).toBe(3)
  })

  it('sin la variable de entorno usa el placeholder, nunca un número', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', '')
    const { container } = montar()
    const href = within(container.querySelector('section#premium'))
      .getByRole('link', { name: /Reservar mi asesoría Premium/ })
      .getAttribute('href')
    expect(href.startsWith('https://wa.me/PENDIENTE_NUMERO?text=')).toBe(true)
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
