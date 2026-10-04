import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import InsigniaTipo from '../components/ui/InsigniaTipo'

describe('InsigniaTipo', () => {
  it('muestra la etiqueta en texto de cada tipo, con tilde en Élite', () => {
    const { rerender } = render(<InsigniaTipo tipo="original" />)
    expect(screen.getByText('Original')).toBeInTheDocument()

    rerender(<InsigniaTipo tipo="elite" />)
    expect(screen.getByText('Élite')).toBeInTheDocument()

    rerender(<InsigniaTipo tipo="vip" />)
    expect(screen.getByText('VIP')).toBeInTheDocument()
  })

  it('el icono es decorativo (oculto a lectores): el significado va en el texto', () => {
    const { container } = render(<InsigniaTipo tipo="vip" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('cada tipo tiene un icono distinto y un estilo distinto (no depende solo del color)', () => {
    const huellas = ['original', 'elite', 'vip'].map((tipo) => {
      const { container, unmount } = render(<InsigniaTipo tipo={tipo} />)
      const huella = {
        forma: container.querySelector('svg path').getAttribute('d'),
        clases: container.firstChild.className,
      }
      unmount()
      return huella
    })

    expect(new Set(huellas.map((h) => h.forma)).size).toBe(3)
    expect(new Set(huellas.map((h) => h.clases)).size).toBe(3)
  })

  it('usa la paleta del proyecto: dorado como borde en Élite y sobre negro en VIP', () => {
    const { container, rerender } = render(<InsigniaTipo tipo="elite" />)
    expect(container.firstChild.className).toContain('border-[#D4AF37]')
    expect(container.firstChild.className).not.toContain('text-[#D4AF37]')

    rerender(<InsigniaTipo tipo="vip" />)
    expect(container.firstChild.className).toContain('bg-black')
    expect(container.firstChild.className).toContain('text-[#D4AF37]')
  })

  it('un tipo desconocido o ausente no renderiza nada', () => {
    const { container, rerender } = render(<InsigniaTipo tipo="oro" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<InsigniaTipo />)
    expect(container).toBeEmptyDOMElement()
  })
})
