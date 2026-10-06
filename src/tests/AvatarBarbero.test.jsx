import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AvatarBarbero from '../components/ui/AvatarBarbero'
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

describe('AvatarBarbero: variante premium y alt con cargo (galería del equipo)', () => {
  it('sin los props nuevos conserva el alt y el respaldo de siempre', () => {
    const { rerender } = render(<AvatarBarbero barbero={{ nombre: 'Boby', foto: '/b.jpg' }} />)
    expect(screen.getByAltText('Foto de Boby, barbero en Black Iron Barbers')).toBeInTheDocument()
    rerender(<AvatarBarbero barbero={{ nombre: 'Boby', foto: null }} />)
    const avatar = screen.getByRole('img', { name: 'Avatar de Boby' })
    expect(avatar).toHaveClass('bg-linear-to-br', 'from-zinc-800', 'to-black', 'text-base')
    expect(avatar.querySelector('.font-cinzel')).toBeNull()
  })

  it('premium: monograma Cinzel con aro dorado; con cargo, el alt lo incluye', () => {
    const { rerender } = render(<AvatarBarbero barbero={{ nombre: 'Ana Ríos', foto: null }} variante="premium" />)
    const monograma = screen.getByRole('img', { name: 'Avatar de Ana Ríos' }).querySelector('.font-cinzel')
    expect(monograma).toHaveTextContent('AR')
    expect(monograma).toHaveClass('ring-oro/60')
    rerender(<AvatarBarbero barbero={{ nombre: 'Camila', foto: '/c.jpg' }} descripcion="Asesora de Imagen" />)
    expect(screen.getByAltText('Foto de Camila, Asesora de Imagen en Black Iron Barbers')).toBeInTheDocument()
  })
})
