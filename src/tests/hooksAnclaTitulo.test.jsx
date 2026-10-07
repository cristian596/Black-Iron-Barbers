import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useScrollAHash } from '../hooks/useScrollAHash'
import { useTitulo } from '../hooks/useTitulo'

const Titulo = ({ titulo, descripcion }) => {
  useTitulo(titulo, descripcion)
  return null
}

describe('useTitulo', () => {
  beforeEach(() => {
    document.title = 'Original'
    document.head.querySelectorAll('meta[name="description"]').forEach((m) => m.remove())
  })

  it('escribe título y meta description y los quita al desmontar (meta creado por el hook)', () => {
    const { unmount } = render(<Titulo titulo="Nuevo" descripcion="Texto nuevo" />)
    expect(document.title).toBe('Nuevo')
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Texto nuevo')

    unmount()
    expect(document.title).toBe('Original')
    expect(document.head.querySelector('meta[name="description"]')).toBeNull()
  })

  it('si ya había un meta description, lo reutiliza y restaura su contenido', () => {
    const meta = document.createElement('meta')
    meta.name = 'description'
    meta.content = 'Previa'
    document.head.appendChild(meta)

    const { unmount } = render(<Titulo titulo="Nuevo" descripcion="Otra" />)
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(meta).toHaveAttribute('content', 'Otra')

    unmount()
    expect(meta).toHaveAttribute('content', 'Previa')
  })

  it('sin descripción solo toca el título', () => {
    const { unmount } = render(<Titulo titulo="Solo título" />)
    expect(document.title).toBe('Solo título')
    expect(document.head.querySelector('meta[name="description"]')).toBeNull()
    unmount()
    expect(document.title).toBe('Original')
  })

  it('actualiza el título si cambian las props', () => {
    const { rerender } = render(<Titulo titulo="Uno" />)
    rerender(<Titulo titulo="Dos" />)
    expect(document.title).toBe('Dos')
  })
})

const Secciones = ({ ids, tardia = false }) => {
  useScrollAHash(ids)
  return (
    <div>
      {!tardia && (
        <section id="uno">
          <h2>Uno</h2>
        </section>
      )}
    </div>
  )
}

describe('useScrollAHash', () => {
  let llamadas
  beforeEach(() => {
    llamadas = []
    Element.prototype.scrollIntoView = vi.fn(function () {
      llamadas.push(this.id)
    })
  })
  afterEach(() => {
    delete Element.prototype.scrollIntoView
    delete window.matchMedia
  })

  it('pone tabindex -1 al encabezado si no lo tenía y le da el foco', () => {
    render(
      <MemoryRouter initialEntries={['/#uno']}>
        <Secciones ids={['uno']} />
      </MemoryRouter>
    )
    const h2 = screen.getByRole('heading', { name: 'Uno' })
    expect(h2).toHaveAttribute('tabindex', '-1')
    expect(h2).toHaveFocus()
  })

  it('ignora ids que no están en la lista y hashes mal codificados', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/#uno']}>
        <Secciones ids={['otro']} />
      </MemoryRouter>
    )
    unmount()
    render(
      <MemoryRouter initialEntries={['/#%E0%A4%A']}>
        <Secciones ids={['uno']} />
      </MemoryRouter>
    )
    expect(llamadas).toHaveLength(0)
  })

  it('si la sección aparece después (React.lazy), espera y entonces hace scroll', async () => {
    const Tardio = () => {
      useScrollAHash(['uno'])
      return null
    }
    render(
      <MemoryRouter initialEntries={['/#uno']}>
        <Tardio />
      </MemoryRouter>
    )
    expect(llamadas).toHaveLength(0)

    const seccion = document.createElement('section')
    seccion.id = 'uno'
    seccion.innerHTML = '<h2>Uno</h2>'
    document.body.appendChild(seccion)

    await waitFor(() => expect(llamadas).toEqual(['uno']))
    expect(seccion.querySelector('h2')).toHaveFocus()
    seccion.remove()
  })
})
