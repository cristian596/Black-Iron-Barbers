import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import AvatarBarbero from '../components/ui/AvatarBarbero'
import TarjetaBarbero from '../components/ui/TarjetaBarbero'
import PasoBarbero from '../components/sections/reserva/PasoBarbero'

describe('AvatarBarbero', () => {
  it('con foto muestra la imagen con su alt descriptivo', () => {
    render(<AvatarBarbero barbero={{ nombre: 'Boby', foto: '/Barberos/boby.jpg' }} />)
    expect(screen.getByAltText(/foto de boby/i)).toHaveAttribute('src', '/Barberos/boby.jpg')
  })

  it.each([null, undefined, ''])('sin foto (%j) muestra las iniciales, accesibles como imagen', (foto) => {
    render(<AvatarBarbero barbero={{ nombre: 'Ángel Mejía', foto }} />)
    expect(screen.queryByRole('img', { name: /foto de/i })).toBeNull()
    const avatar = screen.getByRole('img', { name: 'Avatar de Ángel Mejía' })
    expect(avatar).toHaveTextContent('ÁM')
  })

  it('si la imagen no carga, cambia a las iniciales', () => {
    render(<AvatarBarbero barbero={{ nombre: 'Davinson', foto: '/Barberos/no-existe.jpg' }} />)
    fireEvent.error(screen.getByAltText(/foto de davinson/i))
    expect(screen.getByRole('img', { name: 'Avatar de Davinson' })).toHaveTextContent('D')
    expect(screen.queryByAltText(/foto de davinson/i)).toBeNull()
  })

  it('si cambia la foto después de un fallo, vuelve a intentar con la nueva', () => {
    const { rerender } = render(<AvatarBarbero barbero={{ nombre: 'Leo', foto: '/mala.jpg' }} />)
    fireEvent.error(screen.getByAltText(/foto de leo/i))
    rerender(<AvatarBarbero barbero={{ nombre: 'Leo', foto: '/buena.jpg' }} />)
    expect(screen.getByAltText(/foto de leo/i)).toHaveAttribute('src', '/buena.jpg')
  })
})

describe('componentes públicos con un barbero sin foto (creado desde el admin)', () => {
  it('TarjetaBarbero muestra las iniciales y conserva nombre, cargo y el botón de reservar', () => {
    render(
      <MemoryRouter>
        <TarjetaBarbero barbero={{ id: 9, nombre: 'Nuevo Barbero', cargo: 'Barbero Profesional', especialidad: 'Fade', foto: null }} />
      </MemoryRouter>
    )
    expect(screen.getByRole('img', { name: 'Avatar de Nuevo Barbero' })).toHaveTextContent('NB')
    expect(screen.getByRole('heading', { name: 'Nuevo Barbero' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reservar con nuevo barbero/i })).toBeInTheDocument()
  })

  it('PasoBarbero muestra las iniciales junto a quien sí tiene foto', () => {
    render(
      <PasoBarbero
        barberos={[
          { id: 1, nombre: 'Boby', especialidad: 'Fade', foto: '/Barberos/boby.jpg' },
          { id: 2, nombre: 'Ana Ríos', especialidad: 'Barba', foto: null },
        ]}
        barberoIdSeleccionado={null}
        onSeleccionar={vi.fn()}
      />
    )
    expect(screen.getByAltText(/foto de boby/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Avatar de Ana Ríos' })).toHaveTextContent('AR')
    expect(screen.getByRole('heading', { name: 'Ana Ríos' }).closest('button')).toBeInTheDocument()
  })
})
