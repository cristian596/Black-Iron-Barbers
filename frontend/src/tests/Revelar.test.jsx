import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import Revelar from '../components/ui/Revelar'
import { retrasoEscalonado } from '../utils/escalonado'

// IntersectionObserver simulado: guarda las instancias para dispararlas a mano
const observers = []
class IntersectionObserverFalso {
  constructor(callback, opciones) {
    this.callback = callback
    this.opciones = opciones
    this.elementos = []
    this.observe = vi.fn((elemento) => this.elementos.push(elemento))
    this.unobserve = vi.fn()
    this.disconnect = vi.fn()
    observers.push(this)
  }
  disparar(isIntersecting, objetivos = this.elementos) {
    this.callback(objetivos.map((target) => ({ target, isIntersecting })))
  }
}

// jsdom no calcula layout: la posición vertical se lee de data-top (por defecto,
// muy por debajo del viewport de 768 px)
const POR_DEBAJO = 2000
let rectOriginal
beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('IntersectionObserver', IntersectionObserverFalso)
  rectOriginal = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    return { top: Number(this.dataset?.top ?? POR_DEBAJO), bottom: 0, left: 0, right: 0, width: 0, height: 0 }
  }
})

afterEach(() => {
  Element.prototype.getBoundingClientRect = rectOriginal
  vi.unstubAllGlobals()
  delete window.matchMedia
})

const simularMovimientoReducido = (reducido) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reducido && query.includes('prefers-reduced-motion'),
    media: query,
  }))
}

const entrar = () => act(() => observers.at(-1).disparar(true))
const traslacionInicial = /(^|\s)-?translate-[xy]-\d/

describe('Revelar: entrada al hacer scroll', () => {
  it('queda oculto hasta que es visible, entra una vez y no se repite', () => {
    render(<Revelar data-testid='bloque'>Contenido</Revelar>)
    const bloque = screen.getByTestId('bloque')

    expect(bloque).toHaveClass('opacity-0', 'translate-y-6')
    expect(bloque).not.toHaveClass('opacity-100')

    entrar()
    expect(bloque).toHaveClass('opacity-100', 'translate-none')
    expect(bloque).not.toHaveClass('opacity-0')

    // Al salir y volver a entrar no vuelve a ocultarse ni a animarse
    act(() => observers.at(-1).disparar(false))
    act(() => observers.at(-1).disparar(true))
    expect(bloque).toHaveClass('opacity-100', 'translate-none')
    expect(bloque).not.toHaveClass('opacity-0')
  })

  it('observa con umbral bajo y margen negativo moderado', () => {
    render(<Revelar>Contenido</Revelar>)

    expect(observers.at(-1).opciones).toEqual({ threshold: 0.05, rootMargin: '0px 0px -8% 0px' })
  })

  it('solo anima opacity y translate, con 600 ms y salida suave', () => {
    render(<Revelar data-testid='bloque'>Contenido</Revelar>)
    const bloque = screen.getByTestId('bloque')

    expect(bloque).toHaveClass('transition-[opacity,translate]', 'duration-600', 'ease-out')
    expect(bloque).toHaveClass('motion-reduce:transition-none')
  })

  it('tras revelarse no conserva ningún transform', () => {
    render(<Revelar data-testid='bloque'>Contenido</Revelar>)
    const bloque = screen.getByTestId('bloque')
    expect(bloque.className).toMatch(traslacionInicial)

    entrar()
    expect(bloque.className).not.toMatch(traslacionInicial)
    expect(bloque).not.toHaveClass('translate-y-0')
    expect(bloque).toHaveClass('translate-none')
    expect(bloque.style.transform).toBe('')
  })

  it('las variantes laterales desplazan 16 px en horizontal', () => {
    render(
      <>
        <Revelar variante='izquierda' data-testid='izq'>a</Revelar>
        <Revelar variante='derecha' data-testid='der'>b</Revelar>
      </>
    )

    expect(screen.getByTestId('izq')).toHaveClass('-translate-x-4')
    expect(screen.getByTestId('der')).toHaveClass('translate-x-4')
    entrar()
    expect(screen.getByTestId('izq')).toHaveClass('translate-none')
    expect(screen.getByTestId('der')).toHaveClass('translate-none')
  })

  it('aplica el retardo, usa la etiqueta pedida y respeta className', () => {
    render(
      <Revelar como='section' retraso={240} className='mx-auto' data-testid='bloque'>
        Contenido
      </Revelar>
    )
    const bloque = screen.getByTestId('bloque')

    expect(bloque.tagName).toBe('SECTION')
    expect(bloque).toHaveClass('mx-auto')
    expect(bloque.style.transitionDelay).toBe('240ms')
  })
})

describe('Revelar: observer compartido', () => {
  it('varios bloques comparten un único observer y se liberan uno a uno', () => {
    render(
      <>
        <Revelar data-testid='a'>a</Revelar>
        <Revelar data-testid='b'>b</Revelar>
        <Revelar data-testid='c'>c</Revelar>
      </>
    )

    expect(observers).toHaveLength(1)
    const observer = observers[0]
    expect(observer.observe).toHaveBeenCalledTimes(3)

    act(() => observer.disparar(true, [screen.getByTestId('a')]))
    expect(screen.getByTestId('a')).toHaveClass('opacity-100')
    expect(screen.getByTestId('b')).toHaveClass('opacity-0')
    expect(observer.unobserve).toHaveBeenCalledTimes(1)
    expect(observer.disconnect).not.toHaveBeenCalled()

    act(() => observer.disparar(true, [screen.getByTestId('b'), screen.getByTestId('c')]))
    expect(observer.unobserve).toHaveBeenCalledTimes(3)
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
  })

  it('se desconecta tras la primera aparición', () => {
    render(<Revelar>Contenido</Revelar>)
    const observer = observers.at(-1)
    expect(observer.disconnect).not.toHaveBeenCalled()

    entrar()
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('se limpia al desmontar', () => {
    const { unmount } = render(<Revelar>Contenido</Revelar>)
    const observer = observers.at(-1)

    unmount()
    expect(observer.unobserve).toHaveBeenCalled()
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('un grupo nuevo crea un observer nuevo tras desconectarse el anterior', () => {
    const primero = render(<Revelar>a</Revelar>)
    primero.unmount()
    render(<Revelar>b</Revelar>)

    expect(observers).toHaveLength(2)
    expect(observers[1].observe).toHaveBeenCalledTimes(1)
  })
})

describe('Revelar: sin animación', () => {
  it('con prefers-reduced-motion se muestra directo, sin ocultar ni observar', () => {
    simularMovimientoReducido(true)
    render(<Revelar data-testid='bloque'>Contenido</Revelar>)
    const bloque = screen.getByTestId('bloque')

    expect(bloque).toHaveClass('opacity-100', 'translate-none')
    expect(bloque).not.toHaveClass('opacity-0')
    expect(bloque.className).not.toMatch(traslacionInicial)
    expect(bloque.className).not.toMatch(/transition|duration/)
    expect(observers).toHaveLength(0)
  })

  it('sin IntersectionObserver se muestra directo, sin ocultar nada', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Revelar data-testid='bloque'>Contenido</Revelar>)
    const bloque = screen.getByTestId('bloque')

    expect(bloque).toHaveClass('opacity-100', 'translate-none')
    expect(bloque).not.toHaveClass('opacity-0')
    expect(bloque.className).not.toMatch(traslacionInicial)
  })
})

describe('Revelar: contenido ya visible al montar', () => {
  it('un bloque en la primera pantalla no se oculta ni se anima', () => {
    render(<Revelar data-top='120' data-testid='bloque'>Hero</Revelar>)
    const bloque = screen.getByTestId('bloque')

    expect(bloque).toHaveClass('opacity-100', 'translate-none')
    expect(bloque).not.toHaveClass('opacity-0')
    expect(bloque.className).not.toMatch(/transition|duration/)
    expect(observers).toHaveLength(0)
  })

  it('tras recargar con scroll a mitad, lo que queda por encima se muestra directo', () => {
    render(
      <>
        <Revelar data-top='-900' data-testid='arriba'>ya pasó</Revelar>
        <Revelar data-top='-300' data-testid='justo-arriba'>ya pasó</Revelar>
        <Revelar data-top='1500' data-testid='abajo'>aún no</Revelar>
      </>
    )

    ;['arriba', 'justo-arriba'].forEach((id) => {
      const bloque = screen.getByTestId(id)
      expect(bloque).toHaveClass('opacity-100', 'translate-none')
      expect(bloque).not.toHaveClass('opacity-0')
      expect(bloque.className).not.toMatch(/transition|duration/)
    })
    expect(screen.getByTestId('abajo')).toHaveClass('opacity-0')
    // Solo el de abajo llegó a registrarse en el observer
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledTimes(1)
    expect(observers[0].elementos[0]).toBe(screen.getByTestId('abajo'))
  })
})

describe('Revelar: accesibilidad', () => {
  it('oculto no esconde el contenido a lectores de pantalla ni al teclado', () => {
    render(
      <Revelar data-testid='bloque'>
        <button type='button'>Reservar</button>
      </Revelar>
    )
    const bloque = screen.getByTestId('bloque')

    expect(bloque).toHaveClass('opacity-0')
    expect(bloque).not.toHaveAttribute('aria-hidden')
    expect(bloque).not.toHaveAttribute('hidden')
    expect(bloque.className).not.toMatch(/invisible|hidden/)
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument()
  })

  it('un elemento oculto que recibe foco con teclado se revela', () => {
    render(
      <Revelar data-testid='bloque'>
        <button type='button'>Reservar</button>
      </Revelar>
    )
    const bloque = screen.getByTestId('bloque')
    expect(bloque).toHaveClass('opacity-0')

    fireEvent.focus(screen.getByRole('button', { name: 'Reservar' }))
    expect(bloque).toHaveClass('opacity-100', 'translate-none')
    expect(bloque).not.toHaveClass('opacity-0')
    // Y se libera del observer
    expect(observers.at(-1).disconnect).toHaveBeenCalled()
  })
})

describe('retrasoEscalonado', () => {
  it('crece 80 ms por elemento', () => {
    expect([0, 1, 2, 3, 4].map((i) => retrasoEscalonado(i))).toEqual([0, 80, 160, 240, 320])
  })

  it('respeta el tope de 400 ms en listas largas', () => {
    expect(retrasoEscalonado(5)).toBe(400)
    expect(retrasoEscalonado(6)).toBe(400)
    expect(retrasoEscalonado(40)).toBe(400)
  })

  it('admite paso y tope propios', () => {
    expect(retrasoEscalonado(3, 100, 250)).toBe(250)
    expect(retrasoEscalonado(2, 100, 250)).toBe(200)
  })

  it('un índice negativo o inválido da 0', () => {
    expect(retrasoEscalonado(-3)).toBe(0)
    expect(retrasoEscalonado(Number.NaN)).toBe(0)
  })
})
