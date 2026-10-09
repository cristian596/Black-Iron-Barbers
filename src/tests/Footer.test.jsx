import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Footer from '../components/layout/Footer'
import { enlaceMapa, contacto, HORARIO_ATENCION, REDES_SOCIALES } from '../data/negocio'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const Ruta = () => {
  const { pathname, hash } = useLocation()
  return <p data-testid="ruta">{pathname + hash}</p>
}

const montar = (ruta = '/', props = {}) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="*" element={<><Footer {...props} /><Ruta /></>} />
      </Routes>
    </MemoryRouter>
  )

const pie = () => screen.getByRole('contentinfo')

describe('Footer: estructura y destinos', () => {
  it('navegación del pie con sus destinos', () => {
    montar()
    const nav = screen.getByRole('navigation', { name: 'Pie de página' })
    const destinos = Object.fromEntries(
      within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])
    )
    expect(destinos).toEqual({
      Inicio: '/',
      'Servicios y precios': '/cortes',
      Asesorías: '/asesorias',
      'Nuestro equipo': '/#equipo',
      Reservar: '/reservar-corte',
    })
  })

  it('banda de acción: botón a /reservar-corte y enlace a /asesorias#gratis', () => {
    montar('/cortes')
    expect(screen.getByRole('heading', { level: 2, name: '¿Listo para tu próximo corte?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'RESERVA TU EXPERIENCIA' })).toHaveAttribute('href', '/reservar-corte')
    expect(screen.getByRole('link', { name: '¿Primera vez? Tu primera asesoría es gratis' })).toHaveAttribute(
      'href',
      '/asesorias#gratis'
    )
  })

  it('cuatro bloques: marca, navegación, horario y contacto (h2, ningún h1)', () => {
    montar()
    const titulos = within(pie()).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Navegación', 'Horario', 'Contacto'])
    expect(within(pie()).getByText('Black Iron Barbers')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('horario: lunes a domingo, 10:00 a. m. – 8:00 p. m.', () => {
    montar()
    expect(within(pie()).getByText('Lunes a domingo')).toBeInTheDocument()
    expect(within(pie()).getByText('10:00 a. m. – 8:00 p. m.')).toBeInTheDocument()
    expect(HORARIO_ATENCION).toMatchObject({ apertura: '10:00', cierre: '20:00' })
  })

  it('contacto: dirección a Google Maps (pestaña nueva) y correo mailto', () => {
    montar()
    const mapa = within(pie()).getByRole('link', { name: contacto.direccion })
    expect(mapa).toHaveAttribute('href', enlaceMapa(contacto.direccion))
    expect(mapa.getAttribute('href')).toContain('google.com/maps')
    expect(mapa.getAttribute('href')).toContain(encodeURIComponent('Calle 22 #1-69 Facatativa'))
    expect(mapa).toHaveAttribute('target', '_blank')
    expect(mapa).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(pie()).getByRole('link', { name: contacto.correo })).toHaveAttribute(
      'href',
      'mailto:blackIronBarbers@corre.com'
    )
  })

  it('el clic en "Nuestro equipo" va a /#equipo', async () => {
    montar('/cortes')
    await userEvent.click(within(pie()).getByRole('link', { name: 'Nuestro equipo' }))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/#equipo')
  })
})

describe('Footer: WhatsApp', () => {
  it('sin número real no muestra el enlace', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', '')
    montar()
    expect(within(pie()).queryByRole('link', { name: /WhatsApp/ })).toBeNull()
  })

  it('con número real lo muestra con el helper de WhatsApp', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', '570000000000')
    montar()
    const enlace = within(pie()).getByRole('link', { name: /WhatsApp/ })
    expect(enlace.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/570000000000\?text=/)
    expect(enlace).toHaveAttribute('target', '_blank')
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('Footer: redes sociales', () => {
  it('cada red tiene aria-label; con "#" el clic no cambia la ruta y no abre pestaña', async () => {
    montar('/cortes')
    for (const nombre of ['Facebook', 'Instagram', 'TikTok']) {
      const enlace = within(pie()).getByRole('link', { name: `${nombre} de Black Iron Barbers` })
      expect(enlace).toHaveAttribute('href', '#')
      expect(enlace).not.toHaveAttribute('target')
      await userEvent.click(enlace)
      expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/cortes$/)
    }
  })

  it('con URL real abre en pestaña nueva con rel seguro', () => {
    const redes = REDES_SOCIALES.map((r) => ({ ...r, url: `https://ejemplo.com/${r.id}` }))
    montar('/', { redes })
    const enlace = within(pie()).getByRole('link', { name: 'Instagram de Black Iron Barbers' })
    expect(enlace).toHaveAttribute('href', 'https://ejemplo.com/instagram')
    expect(enlace).toHaveAttribute('target', '_blank')
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('los íconos son decorativos (aria-hidden), incluidos los SVG de contacto', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMERO', '570000000000')
    montar()
    const svgs = pie().querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(7)
    svgs.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'))
  })
})

describe('Footer: banda de acción según la ruta', () => {
  it.each(['/reservar-corte', '/reservar-corte/'])('se oculta en %s', (ruta) => {
    montar(ruta)
    expect(screen.queryByRole('heading', { name: '¿Listo para tu próximo corte?' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'RESERVA TU EXPERIENCIA' })).toBeNull()
    expect(within(pie()).getByRole('link', { name: 'Reservar' })).toBeInTheDocument()
  })

  it.each(['/', '/cortes', '/asesorias'])('se muestra en %s', (ruta) => {
    montar(ruta)
    expect(screen.getByRole('heading', { name: '¿Listo para tu próximo corte?' })).toBeInTheDocument()
  })
})

describe('Footer: barra inferior', () => {
  it('textos corregidos y año actual', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2031-06-15T12:00:00'))
    montar()
    expect(within(pie()).getByText('El corte cambia. La filosofía nunca.')).toBeInTheDocument()
    expect(within(pie()).getByText('© 2031 Black Iron Barbers — Todos los derechos reservados')).toBeInTheDocument()
    expect(within(pie()).getByText('No es solo un corte. Es tu firma.')).toBeInTheDocument()
    expect(pie().textContent).not.toMatch(/filosofía\. nunca|Barber --|Barber —/)
  })

  it('"Volver arriba" sube a 0; con movimiento reducido sin animación', async () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    const matchMedia = vi.fn().mockReturnValue({ matches: false })
    vi.stubGlobal('matchMedia', matchMedia)
    montar()
    await userEvent.click(within(pie()).getByRole('button', { name: 'Volver arriba' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })

    matchMedia.mockReturnValue({ matches: true })
    await userEvent.click(within(pie()).getByRole('button', { name: 'Volver arriba' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
    vi.unstubAllGlobals()
  })
})
