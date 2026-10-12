import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GraficoIngresos from '../components/admin/GraficoIngresos'
import GraficoServiciosTop from '../components/admin/GraficoServiciosTop'

const dia = (i) => `2026-09-${String(i + 1).padStart(2, '0')}`

const serie = (n, valor) =>
  Array.from({ length: n }, (_, i) => ({ fecha: dia(i), ingresos: valor(i), cortes: valor(i) > 0 ? 2 : 0 }))

const montarDia = () => {
  const puntos = serie(30, (i) => (i === 3 ? 80000 : i % 5 === 0 ? 20000 : 0))
  const anteriores = serie(30, (i) => (i === 3 ? 50000 : 0))
  return render(<GraficoIngresos agrupar="dia" puntos={puntos} anteriores={anteriores} />)
}

describe('GraficoIngresos', () => {
  it('el SVG es una imagen con aria-label que resume totales, mejor día y la línea del período anterior', () => {
    montarDia()
    const imagen = screen.getByRole('img')

    const etiqueta = imagen.getAttribute('aria-label')
    expect(etiqueta).toMatch(/^Gráfico de barras de ingresos por día \(30 días\)/)
    expect(etiqueta).toContain('Mayor ingreso: 4 sept con $80.000')
    expect(etiqueta).toContain('línea discontinua')
    expect(imagen.tagName.toLowerCase()).toBe('svg')
  })

  it('tiene una tabla oculta con los 30 días, sus ingresos, cortes y el período anterior', () => {
    montarDia()
    const tabla = screen.getByRole('table', { name: /Ingresos por día/ })

    // Dentro de un contenedor sr-only (una tabla suelta no se reduce a 1 px y ensancharía la página)
    expect(tabla.parentElement).toHaveClass('sr-only')
    const filas = within(tabla).getAllByRole('row')
    expect(filas).toHaveLength(31) // encabezado + 30 días
    const fila = within(tabla).getByRole('row', { name: /^4 sept/ })
    expect(within(fila).getAllByRole('cell').map((c) => c.textContent)).toEqual(['$80.000', '2', '$50.000'])
  })

  it('el eje Y tiene 4 divisiones (5 marcas) con valores redondos', () => {
    const { container } = montarDia()
    const marcas = [...container.querySelectorAll('svg text')].map((t) => t.textContent).filter((t) => t.startsWith('$'))

    expect(marcas.slice(0, 5)).toEqual(['$0', '$20 mil', '$40 mil', '$60 mil', '$80 mil'])
  })

  it('las barras son doradas y el período anterior una línea discontinua en zinc, todo con clases de Tailwind', () => {
    const { container } = montarDia()
    const svg = container.querySelector('svg')

    expect(svg.querySelectorAll('rect.fill-oro')).toHaveLength(7) // 4 sept + 6 días de 20.000 (cada 5)
    const linea = svg.querySelector('path')
    expect(linea).toHaveClass('stroke-zinc-400', '[stroke-dasharray:5_4]')
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })

  it('al pasar el mouse muestra el detalle (tooltip) del día', async () => {
    const { container } = montarDia()
    const svg = container.querySelector('svg')
    expect(within(svg).queryByText('Antes: $50.000')).toBeNull()

    await userEvent.hover(screen.getByRole('button', { name: /^4 sept: \$80\.000/ }))

    expect(within(svg).getByText('4 sept')).toBeInTheDocument()
    expect(within(svg).getByText('$80.000')).toBeInTheDocument()
    expect(within(svg).getByText('2 cortes')).toBeInTheDocument()
    expect(within(svg).getByText('Antes: $50.000')).toBeInTheDocument()

    await userEvent.unhover(screen.getByRole('button', { name: /^4 sept: \$80\.000/ }))
    expect(within(svg).queryByText('Antes: $50.000')).toBeNull()
  })

  it('con teclado: un solo tab stop, flechas entre barras, Escape cierra el detalle', async () => {
    const { container } = montarDia()
    const svg = container.querySelector('svg')
    const botones = screen.getAllByRole('button')
    expect(botones).toHaveLength(30)
    expect(botones.filter((b) => b.tabIndex === 0)).toHaveLength(1)

    await userEvent.tab()
    expect(botones[29]).toHaveFocus() // empieza en el día más reciente
    await userEvent.keyboard('{ArrowLeft}')
    expect(botones[28]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(botones[0]).toHaveFocus()
    expect(within(svg).getByText('1 sept')).toBeInTheDocument() // el foco también abre el detalle
    await userEvent.keyboard('{End}')
    expect(botones[29]).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(botones[29]).toHaveFocus() // no se sale por la derecha

    await userEvent.keyboard('{Escape}')
    expect(within(svg).queryByText(/Antes:/)).toBeNull()
  })

  it('un toque (clic) abre el detalle y tocar fuera lo cierra', async () => {
    const { container } = montarDia()
    const svg = container.querySelector('svg')

    await userEvent.click(screen.getByRole('button', { name: /^4 sept/ }))
    expect(within(svg).getByText('Antes: $50.000')).toBeInTheDocument()

    await userEvent.click(document.body)
    expect(within(svg).queryByText(/Antes:/)).toBeNull()
  })

  it('por mes: etiquetas de mes y tabla con el mes completo', () => {
    const puntos = [
      { mes: '2026-09', ingresos: 40000, cortes: 3 },
      { mes: '2026-10', ingresos: 30000, cortes: 2 },
    ]
    const anteriores = [
      { mes: '2025-09', ingresos: 0, cortes: 0 },
      { mes: '2025-10', ingresos: 7000, cortes: 1 },
    ]
    render(<GraficoIngresos agrupar="mes" puntos={puntos} anteriores={anteriores} />)

    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/por mes \(2 meses\)/)
    expect(screen.getByRole('table', { name: /Ingresos por mes/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /septiembre de 2026/ })).toBeInTheDocument()
  })

  it('las transiciones usan solo motion-safe (respetan prefers-reduced-motion)', () => {
    const { container } = montarDia()
    const sinPrefijo = [...container.querySelectorAll('[class]')]
      .flatMap((e) => [...e.classList])
      .filter((c) => /^(animate-|transition)/.test(c))

    expect(sinPrefijo).toEqual([])
  })
})

describe('GraficoServiciosTop', () => {
  const servicios = [
    { id: 1, nombre: 'Corte clásico', cantidad: 12, ingresos: 300000 },
    { id: 2, nombre: 'Barba', cantidad: 6, ingresos: 90000 },
  ]

  it('SVG con aria-label y una tabla oculta con servicio, veces e ingresos', () => {
    render(<GraficoServiciosTop servicios={servicios} />)

    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Corte clásico, 12 veces; Barba, 6 veces/)
    const tabla = screen.getByRole('table', { name: /Servicios más pedidos/ })
    expect(within(tabla).getByRole('row', { name: /Corte clásico/ })).toHaveTextContent('$300.000')
  })

  it('la barra más larga es la del servicio más pedido y usa el token de oro', () => {
    const { container } = render(<GraficoServiciosTop servicios={servicios} />)
    const doradas = [...container.querySelectorAll('rect.fill-oro')].map((r) => Number(r.getAttribute('width')))

    expect(doradas[0]).toBeGreaterThan(doradas[1])
    expect(doradas[1]).toBeCloseTo(doradas[0] / 2, 0)
  })
})
