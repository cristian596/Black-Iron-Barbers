import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '../components/layout/NavBar'

const renderNavBar = (ruta = '/') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <NavBar />
    </MemoryRouter>
  )

const navPrincipal = () => screen.getByRole('navigation', { name: 'Principal' })

const hacerScroll = (y) => {
  act(() => {
    window.scrollY = y
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('NavBar', () => {
  it('marca solo el enlace de la ruta actual con aria-current', () => {
    renderNavBar('/cortes')
    const nav = within(navPrincipal())

    expect(nav.getByRole('link', { name: 'Servicios' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
    expect(nav.getByRole('link', { name: 'Ubicaciones' })).not.toHaveAttribute('aria-current')
  })

  it('"Inicio" solo está activo en la raíz', () => {
    renderNavBar('/')
    expect(within(navPrincipal()).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('el header es sticky y pasa a fondo desenfocado al hacer scroll', () => {
    renderNavBar()
    const header = screen.getByRole('banner')

    expect(header).toHaveClass('sticky', 'top-0')
    expect(header).toHaveAttribute('data-scrolled', 'false')
    expect(header).not.toHaveClass('backdrop-blur-md')

    hacerScroll(200)
    expect(header).toHaveAttribute('data-scrolled', 'true')
    expect(header).toHaveClass('backdrop-blur-md')

    hacerScroll(0)
    expect(header).toHaveAttribute('data-scrolled', 'false')
  })

  it('"Agendar" es un enlace a la reserva', () => {
    renderNavBar()
    expect(within(navPrincipal()).getByRole('link', { name: /Agendar/ })).toHaveAttribute(
      'href',
      '/reservar-corte'
    )
  })

  it('no expone ningún enlace público al acceso interno', () => {
    renderNavBar()
    const hrefs = screen.getAllByRole('link', { hidden: true }).map((a) => a.getAttribute('href'))
    expect(hrefs.some((h) => /acceso|panel|admin/.test(h))).toBe(false)
  })

  it('la hamburguesa es un botón que alterna aria-expanded', async () => {
    const user = userEvent.setup()
    renderNavBar()
    const boton = screen.getByRole('button', { name: 'Abrir menú' })

    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton).toHaveAttribute('aria-controls', 'menu-movil')

    await user.click(boton)
    const abierto = screen.getByRole('button', { name: 'Cerrar menú' })
    expect(abierto).toHaveAttribute('aria-expanded', 'true')
  })

  it('con el menú móvil abierto el header sube al borde superior, sobre la franja de garantía', async () => {
    const user = userEvent.setup()
    renderNavBar()
    const header = screen.getByRole('banner')

    expect(header).toHaveClass('sticky')
    expect(header).not.toHaveClass('fixed')

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(header).toHaveClass('fixed', 'top-0', 'inset-x-0')
    expect(header).not.toHaveClass('sticky')

    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }))
    expect(header).toHaveClass('sticky')
  })

  it('el menú móvil queda por encima de los elementos flotantes (z-50 y barra de reserva z-40)', async () => {
    const user = userEvent.setup()
    renderNavBar()
    const menu = document.getElementById('menu-movil')
    const header = screen.getByRole('banner')

    expect(menu).toHaveClass('fixed', 'inset-0', 'z-60')
    expect(header).toHaveClass('z-50')

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(header).toHaveClass('z-70')
  })

  it('Escape cierra el menú móvil y devuelve el foco al botón', async () => {
    const user = userEvent.setup()
    renderNavBar()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    fireEvent.keyDown(document, { key: 'Escape' })

    const boton = screen.getByRole('button', { name: 'Abrir menú' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton).toHaveFocus()
  })

  it('elegir un enlace del menú móvil lo cierra', async () => {
    const user = userEvent.setup()
    renderNavBar()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    const movil = within(screen.getByRole('navigation', { name: 'Menú móvil' }))
    await user.click(movil.getByRole('link', { name: 'Servicios' }))

    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('el menú móvil cerrado no es alcanzable (inert)', () => {
    renderNavBar()
    expect(document.getElementById('menu-movil')).toHaveAttribute('inert')
  })
})
