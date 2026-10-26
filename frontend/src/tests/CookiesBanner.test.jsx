import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BannerCookies from '../components/cookies/BannerCookies'
import PanelCookies from '../components/cookies/PanelCookies'
import Footer from '../components/layout/Footer'
import {
  CLAVE_CONSENTIMIENTO,
  guardarConsentimiento,
  obtenerConsentimiento,
  reiniciarConsentimiento,
} from '../utils/consentimiento'

const montar = () =>
  render(
    <MemoryRouter>
      <BannerCookies />
      <PanelCookies />
      <Footer />
    </MemoryRouter>
  )

const banner = () => screen.queryByRole('region', { name: 'Aviso de cookies' })
const panel = () => screen.queryByRole('dialog', { name: 'Configuración de cookies' })

beforeEach(() => {
  localStorage.clear()
  reiniciarConsentimiento()
})

describe('Banner de cookies', () => {
  it('aparece sin decisión, como región con etiqueta, con enlace a la política y las tres acciones', () => {
    montar()

    const region = banner()
    expect(region).toBeInTheDocument()
    expect(within(region).getByRole('link', { name: 'Política de Cookies' })).toHaveAttribute('href', '/politica-de-cookies')
    expect(within(region).getByRole('button', { name: 'Aceptar' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Configurar' })).toBeInTheDocument()
    // No bloquea: no es un diálogo modal
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Aceptar y Rechazar tienen el mismo peso visual (mismas clases)', () => {
    montar()
    const region = banner()
    expect(within(region).getByRole('button', { name: 'Aceptar' }).className).toBe(
      within(region).getByRole('button', { name: 'Rechazar' }).className
    )
  })

  it('Aceptar guarda analiticas=true y lo cierra', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(within(banner()).getByRole('button', { name: 'Aceptar' }))

    expect(banner()).not.toBeInTheDocument()
    expect(obtenerConsentimiento()).toMatchObject({ analiticas: true })
    expect(JSON.parse(localStorage.getItem(CLAVE_CONSENTIMIENTO))).toMatchObject({ analiticas: true })
  })

  it('Rechazar guarda analiticas=false y lo cierra', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(within(banner()).getByRole('button', { name: 'Rechazar' }))

    expect(banner()).not.toBeInTheDocument()
    expect(obtenerConsentimiento()).toMatchObject({ analiticas: false })
  })

  it('Configurar abre el panel y el banner sigue hasta decidir', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(within(banner()).getByRole('button', { name: 'Configurar' }))

    expect(await screen.findByRole('dialog', { name: 'Configuración de cookies' })).toBeInTheDocument()
    expect(banner()).toBeInTheDocument()
  })

  it('no aparece si ya hay una decisión', () => {
    guardarConsentimiento({ analiticas: false })
    montar()
    expect(banner()).not.toBeInTheDocument()
  })

  it('marca el documento mientras está visible (los elementos fijos suben) y lo quita al decidir', async () => {
    const user = userEvent.setup()
    montar()
    expect(document.documentElement).toHaveAttribute('data-cookies-banner')

    await user.click(within(banner()).getByRole('button', { name: 'Rechazar' }))

    expect(document.documentElement).not.toHaveAttribute('data-cookies-banner')
  })
})

describe('Panel de configuración de cookies', () => {
  const abrirDesdeBanner = async (user) => {
    await user.click(within(banner()).getByRole('button', { name: 'Configurar' }))
    return screen.findByRole('dialog', { name: 'Configuración de cookies' })
  }

  it('es un diálogo modal con el foco dentro', async () => {
    const user = userEvent.setup()
    montar()

    const dialogo = await abrirDesdeBanner(user)

    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => expect(dialogo).toContainElement(document.activeElement))
  })

  it('Escape lo cierra y el foco vuelve al botón que lo abrió', async () => {
    const user = userEvent.setup()
    montar()
    await abrirDesdeBanner(user)

    await user.keyboard('{Escape}')

    expect(panel()).not.toBeInTheDocument()
    await waitFor(() => expect(within(banner()).getByRole('button', { name: 'Configurar' })).toHaveFocus())
  })

  it('las necesarias están siempre activas y no se pueden desactivar', async () => {
    const user = userEvent.setup()
    montar()
    const dialogo = await abrirDesdeBanner(user)

    const necesarias = within(dialogo).getByRole('switch', { name: 'Necesarias' })
    expect(necesarias).toBeChecked()
    expect(necesarias).toBeDisabled()
    await user.click(necesarias)
    expect(necesarias).toBeChecked()
  })

  it('las analíticas empiezan desactivadas; "Guardar preferencias" guarda lo elegido y cierra', async () => {
    const user = userEvent.setup()
    montar()
    const dialogo = await abrirDesdeBanner(user)

    const analiticas = within(dialogo).getByRole('switch', { name: 'Analíticas' })
    expect(analiticas).not.toBeChecked()
    await user.click(analiticas)
    expect(analiticas).toBeChecked()
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar preferencias' }))

    expect(obtenerConsentimiento()).toMatchObject({ analiticas: true })
    expect(panel()).not.toBeInTheDocument()
    expect(banner()).not.toBeInTheDocument()
  })

  it('guardar sin activar las analíticas guarda un rechazo', async () => {
    const user = userEvent.setup()
    montar()
    const dialogo = await abrirDesdeBanner(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Guardar preferencias' }))

    expect(obtenerConsentimiento()).toMatchObject({ analiticas: false })
  })

  it('"Aceptar todas" y "Rechazar todas" guardan la decisión y cierran', async () => {
    const user = userEvent.setup()
    montar()
    let dialogo = await abrirDesdeBanner(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Aceptar todas' }))
    expect(obtenerConsentimiento()).toMatchObject({ analiticas: true })
    expect(panel()).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Configuración de cookies' }))
    dialogo = await screen.findByRole('dialog', { name: 'Configuración de cookies' })
    expect(within(dialogo).getByRole('switch', { name: 'Analíticas' })).toBeChecked()
    await user.click(within(dialogo).getByRole('button', { name: 'Rechazar todas' }))
    expect(obtenerConsentimiento()).toMatchObject({ analiticas: false })
  })
})

describe('Pie de página: configuración de cookies', () => {
  it('es un botón (no un enlace) que reabre el panel aunque ya haya decisión, y devuelve el foco al cerrar', async () => {
    guardarConsentimiento({ analiticas: true })
    const user = userEvent.setup()
    montar()
    const boton = screen.getByRole('button', { name: 'Configuración de cookies' })
    expect(screen.queryByRole('link', { name: 'Configuración de cookies' })).not.toBeInTheDocument()

    await user.click(boton)
    const dialogo = await screen.findByRole('dialog', { name: 'Configuración de cookies' })
    expect(within(dialogo).getByRole('switch', { name: 'Analíticas' })).toBeChecked()

    await user.keyboard('{Escape}')
    expect(panel()).not.toBeInTheDocument()
    await waitFor(() => expect(boton).toHaveFocus())
  })

  it('cambiar la decisión desde el pie la actualiza', async () => {
    guardarConsentimiento({ analiticas: true })
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: 'Configuración de cookies' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Configuración de cookies' })
    await user.click(within(dialogo).getByRole('switch', { name: 'Analíticas' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar preferencias' }))

    expect(obtenerConsentimiento()).toMatchObject({ analiticas: false })
  })

  it('el pie enlaza las tres políticas', () => {
    montar()
    const nav = screen.getByRole('navigation', { name: 'Legal' })
    const destinos = Object.fromEntries(
      within(nav)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')])
    )
    expect(destinos).toEqual({
      'Política de Privacidad': '/politica-de-privacidad',
      'Tratamiento de datos personales': '/tratamiento-de-datos',
      'Política de Cookies': '/politica-de-cookies',
    })
  })

  it('una decisión tomada en otro sitio reinicia el panel incrustado', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(within(banner()).getByRole('button', { name: 'Configurar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Configuración de cookies' })
    expect(within(dialogo).getByRole('switch', { name: 'Analíticas' })).not.toBeChecked()

    act(() => {
      guardarConsentimiento({ analiticas: true })
    })

    expect(within(dialogo).getByRole('switch', { name: 'Analíticas' })).toBeChecked()
  })
})
