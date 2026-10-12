import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home'
import * as api from '../services/api'
import { reiniciarCacheBarberos } from '../hooks/useCantidadBarberos'

vi.mock('../services/api')

beforeEach(() => {
  reiniciarCacheBarberos()
  vi.mocked(api.obtenerBarberos).mockResolvedValue([
    { id: 1, nombre: 'Andrés', cargo: 'Barbero', especialidad: 'Fade', foto: '/a.jpg' },
  ])
})

const montar = async () => {
  const vista = render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
  await screen.findByText('Andrés')
  return vista
}

const seccion = (nombreTitulo) => screen.getByRole('heading', { level: 2, name: nombreTitulo }).closest('section')

const TITULO_1 = 'Tu estilo merece una experiencia a otro nivel.'
const TITULO_2 = 'Tu estilo comienza con los detalles.'

describe('Home: sección "Más que una barbería"', () => {
  it('muestra los textos exactos', async () => {
    await montar()
    const s = within(seccion(TITULO_1))

    expect(s.getByText('MÁS QUE UNA BARBERÍA')).toBeInTheDocument()
    expect(
      s.getByText(
        'En Black Iron creemos que un buen corte es solo el comienzo. Queremos que cada visita sea un momento para desconectarte de la rutina, disfrutar de un servicio profesional y salir con un estilo que realmente represente quién eres.'
      )
    ).toBeInTheDocument()
    // La frase clave va en <strong>, así que se compara el texto completo de cada elemento de la lista
    expect(s.getAllByRole('listitem').map((li) => li.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Barberos profesionales preparados para cuidar cada detalle de tu estilo.',
      'Una experiencia premium con atención personalizada y detalles pensados para ti.',
      'Un espacio diferente donde puedes relajarte, entretenerte y disfrutar mientras renovamos tu look.',
    ])
  })

  it('los íconos de los beneficios son SVG aria-hidden', async () => {
    await montar()
    const items = within(seccion(TITULO_1)).getAllByRole('listitem')

    expect(items).toHaveLength(3)
    items.forEach((li) => {
      const svg = li.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('el botón y el enlace secundario llevan a su destino con tamaño táctil', async () => {
    await montar()
    const s = within(seccion(TITULO_1))
    const boton = s.getByRole('link', { name: 'RESERVA TU EXPERIENCIA' })
    const gratis = s.getByRole('link', { name: '¿Primera vez? Tu primera asesoría es gratis' })

    expect(boton).toHaveAttribute('href', '/reservar-corte')
    expect(boton).toHaveClass('min-h-12')
    expect(gratis).toHaveAttribute('href', '/asesorias#gratis')
    expect(gratis).toHaveClass('min-h-11')
  })

  it('conserva las dos fotos con alt descriptivo y atributos de carga', async () => {
    await montar()
    const fotos = within(seccion(TITULO_1)).getAllByRole('img')

    expect(fotos).toHaveLength(2)
    fotos.forEach((foto) => {
      expect(foto.getAttribute('alt')).not.toBe('')
      expect(foto).toHaveAttribute('loading', 'lazy')
      expect(foto).toHaveAttribute('decoding', 'async')
      expect(foto).toHaveAttribute('width')
      expect(foto).toHaveAttribute('height')
    })
  })
})

describe('Home: sección "Nuestros servicios"', () => {
  it('muestra los textos exactos y el pie con separadores aria-hidden', async () => {
    await montar()
    const s = within(seccion(TITULO_2))

    expect(s.getByText('NUESTROS SERVICIOS')).toBeInTheDocument()
    expect(
      s.getByText(
        'En Black Iron hemos creado una selección de servicios pensados para cuidar tu imagen y hacer que cada visita sea una experiencia diferente. Desde cortes clásicos y modernos hasta el cuidado de tu barba, encuentra el servicio que mejor representa tu estilo.'
      )
    ).toBeInTheDocument()
    ;['Calidad', 'Precisión', 'Estilo'].forEach((p) => expect(s.getByText(p)).toBeInTheDocument())

    const separadores = s.getByText('Calidad').parentElement.querySelectorAll('[aria-hidden="true"]')
    expect(separadores).toHaveLength(2)
    separadores.forEach((sep) => expect(sep.textContent).toBe('·'))
  })

  it('el botón lleva a /cortes con el mismo estilo que el de la otra sección', async () => {
    await montar()
    const boton = within(seccion(TITULO_2)).getByRole('link', { name: 'VER SERVICIOS Y PRECIOS' })
    const otro = within(seccion(TITULO_1)).getByRole('link', { name: 'RESERVA TU EXPERIENCIA' })

    expect(boton).toHaveAttribute('href', '/cortes')
    expect(boton).toHaveClass('min-h-12', 'bg-oro')
    expect(boton.className).toBe(otro.className)
  })

  it('la foto de fondo es decorativa (alt vacío) y reserva su espacio', async () => {
    const { container } = await montar()
    const foto = seccion(TITULO_2).querySelector('img')

    expect(foto).toHaveAttribute('src', '/CourtMan/barberia.jpg')
    expect(foto).toHaveAttribute('alt', '')
    expect(foto).toHaveAttribute('loading', 'lazy')
    expect(foto).toHaveAttribute('decoding', 'async')
    expect(foto).toHaveAttribute('width', '768')
    expect(foto).toHaveAttribute('height', '432')
    expect(container.querySelector('[role="img"]')).toBeNull()
  })
})

describe('Home: encabezados', () => {
  it('las dos secciones usan h2 y la página sigue con un solo h1', async () => {
    await montar()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: TITULO_1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: TITULO_2 })).toBeInTheDocument()
    ;['COME AND TRY', 'Reserva Tu Corte!', 'Mas Información'].forEach((viejo) =>
      expect(screen.queryByText(viejo)).not.toBeInTheDocument()
    )
  })
})
