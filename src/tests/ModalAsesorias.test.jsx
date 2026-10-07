import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import NavBar from '../components/layout/NavBar'
import Modal from '../components/ui/Modal'
import { ASESORIAS } from '../data/asesorias'

const Ubicacion = () => {
  const { pathname, hash } = useLocation()
  return <output data-testid="ubicacion">{pathname + hash}</output>
}

const IrA = () => {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/cortes')}>
      ir-a-cortes
    </button>
  )
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <NavBar />
      <Ubicacion />
      <IrA />
    </MemoryRouter>
  )

const botonEscritorio = () =>
  within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Soy cliente nuevo' })
const dialogo = () => screen.queryByRole('dialog')

beforeEach(() => {
  sessionStorage.clear()
})

describe('Botón "Soy cliente nuevo"', () => {
  it('está en la barra principal, justo después del logo, y no abre nada por sí solo', () => {
    montar()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    const logo = within(nav).getByRole('link', { name: /Black Iron Barbers/ })
    const boton = botonEscritorio()

    expect(boton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(logo.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(logo.parentElement).toBe(boton.parentElement)
    expect(dialogo()).toBeNull()
  })

  it('también está dentro del menú móvil, como primer elemento', () => {
    montar()
    const menu = screen.getByRole('navigation', { name: 'Menú móvil', hidden: true })
    const primero = menu.firstElementChild
    expect(primero).toHaveTextContent('Soy cliente nuevo')
    expect(primero.tagName).toBe('BUTTON')
  })

  it('el pulso aparece una sola vez por sesión', () => {
    const { unmount } = montar()
    // La clase lleva el prefijo "motion-safe:", por eso se busca por fragmento.
    const anillo = (boton) => boton.querySelector('[class*="animate-ping"]')
    expect(anillo(botonEscritorio())).not.toBeNull()
    unmount()

    montar()
    expect(anillo(botonEscritorio())).toBeNull()
  })
})

describe('Modal de asesorías', () => {
  it('se abre con el clic y está bien rotulado', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())

    const d = screen.getByRole('dialog', { name: '¿Primera vez en Black Iron?' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(d.parentElement).toHaveClass('z-80')
    expect(document.body).toHaveClass('overflow-hidden')
  })

  it('muestra las tres opciones con su ancla, precio y duración', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())

    const d = within(screen.getByRole('dialog'))
    expect(d.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(
      ASESORIAS.map((a) => a.titulo)
    )
    expect(d.getByRole('link', { name: /Asesoría de imagen gratis/ })).toHaveAttribute('href', '/asesorias#gratis')
    expect(d.getByRole('link', { name: /Asesoría Premium/ })).toHaveAttribute('href', '/asesorias#premium')
    expect(d.getByRole('link', { name: /Asesoría de barba/ })).toHaveAttribute('href', '/asesorias#barba')
    expect(d.getByText('GRATIS · 15 min')).toBeInTheDocument()
    expect(d.getByText('$60.000 · 1 h')).toBeInTheDocument()
    expect(d.getByText('$45.000 · 45 min')).toBeInTheDocument()
    expect(d.getByRole('link', { name: 'Solo quiero reservar mi corte' })).toHaveAttribute('href', '/reservar-corte')
  })

  it('Escape lo cierra y el foco vuelve al botón', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())
    await user.keyboard('{Escape}')

    expect(dialogo()).toBeNull()
    expect(botonEscritorio()).toHaveFocus()
    expect(document.body).not.toHaveClass('overflow-hidden')
  })

  it('el botón X (44 px) lo cierra y devuelve el foco', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())

    const x = within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' })
    expect(x).toHaveClass('size-11')
    await user.click(x)

    expect(dialogo()).toBeNull()
    expect(botonEscritorio()).toHaveFocus()
  })

  it('el clic en el fondo lo cierra; dentro de la caja no', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())

    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(dialogo()).not.toBeNull()

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement)
    expect(dialogo()).toBeNull()
    expect(botonEscritorio()).toHaveFocus()
  })

  it('elegir una tarjeta navega al ancla y cierra el modal', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: /Asesoría Premium/ }))

    expect(dialogo()).toBeNull()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/asesorias#premium')
  })

  it('se cierra solo si cambia la ruta (p. ej. botón Atrás)', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())
    expect(dialogo()).not.toBeNull()

    // El modal bloquea el resto; navegamos por código como lo haría el historial.
    await user.click(screen.getByRole('button', { name: 'ir-a-cortes', hidden: true }))

    expect(dialogo()).toBeNull()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/cortes')
  })

  it('atrapa el foco: Tab y Shift+Tab dan la vuelta dentro del diálogo', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(botonEscritorio())
    const d = within(screen.getByRole('dialog'))

    expect(d.getByRole('button', { name: 'Cerrar' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(d.getByRole('link', { name: 'Solo quiero reservar mi corte' })).toHaveFocus()

    await user.tab()
    expect(d.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('desde el menú móvil: cierra el menú, abre el modal y el foco vuelve a la hamburguesa', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const menu = within(screen.getByRole('navigation', { name: 'Menú móvil' }))
    await user.click(menu.getByRole('button', { name: 'Soy cliente nuevo' }))

    expect(dialogo()).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{Escape}')
    expect(dialogo()).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus()
  })
})

describe('Modal compartido (props por defecto)', () => {
  it('sin props nuevas conserva z-50, max-w-md y la alineación de siempre', () => {
    render(
      <Modal idTitulo="t" alCerrar={() => {}}>
        <h2 id="t">Hola</h2>
      </Modal>
    )
    const caja = screen.getByRole('dialog', { name: 'Hola' })
    const fondo = caja.parentElement
    expect(fondo.className).toBe('fixed inset-0 z-50 flex overflow-y-auto bg-black/80 p-4 items-start sm:items-center')
    expect(caja).toHaveClass('max-w-md', 'w-full', 'rounded-2xl', 'p-5')
    expect(caja).not.toHaveClass('max-h-[90dvh]')
  })
})

describe('Datos de asesorías', () => {
  it('son tres, con ids estables y precios/duraciones válidos', () => {
    expect(ASESORIAS.map((a) => a.id)).toEqual(['gratis', 'premium', 'barba'])
    expect(ASESORIAS.map((a) => a.precio)).toEqual([0, 60000, 45000])
    expect(ASESORIAS.map((a) => a.duracion_min)).toEqual([15, 60, 45])
  })
})
