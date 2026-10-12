import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import ReservaATuManera from '../components/sections/ReservaATuManera'
import { RUTA_ASESORIA } from '../data/negocio'

const Ubicacion = () => {
  const { pathname, hash } = useLocation()
  return <p data-testid='ubicacion'>{pathname + hash}</p>
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <ReservaATuManera />
      <Ubicacion />
    </MemoryRouter>
  )

const TEXTO = 'Descubre tu mejor versión con una ASESORÍA de imagen GRATIS en BlackIron'

describe('ReservaATuManera: botón de asesoría', () => {
  it('muestra el texto exacto', () => {
    montar()
    expect(screen.getByText((_, el) => el.tagName === 'A' && el.textContent === TEXTO)).toBeInTheDocument()
  })

  it('es un enlace accesible por rol con su nombre completo', () => {
    montar()
    const enlace = screen.getByRole('link', { name: TEXTO })
    expect(enlace).toHaveAttribute('href', RUTA_ASESORIA)
  })

  it('apunta a la ancla de la asesoría gratis', () => {
    expect(RUTA_ASESORIA).toBe('/asesorias#gratis')
  })

  it('el clic navega a /asesorias#gratis (ya no se bloquea)', async () => {
    montar()
    await userEvent.click(screen.getByRole('link', { name: TEXTO }))
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/asesorias#gratis')
  })
})
