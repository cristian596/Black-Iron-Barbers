import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import Estadisticas from '../components/sections/Estadisticas'
import useVisible from '../hooks/useVisible'
import { interpolar, formatearCifra } from '../utils/conteo'
import * as api from '../services/api'
import { reiniciarCacheBarberos } from '../hooks/useCantidadBarberos'

vi.mock('../services/api')

// IntersectionObserver simulado: guarda las instancias para dispararlas a mano
const observers = []
class IntersectionObserverFalso {
  constructor(callback, opciones) {
    this.opciones = opciones
    this.callback = callback
    this.observe = vi.fn()
    this.disconnect = vi.fn()
    observers.push(this)
  }
  disparar(isIntersecting) {
    this.callback([{ isIntersecting }])
  }
}

const simularMovimientoReducido = (reducido) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reducido && query.includes('prefers-reduced-motion'),
    media: query,
  }))
}

const mostrados = () => screen.getAllByTestId('cifra-animada').map((el) => el.textContent)
const entrar = () => act(() => observers.at(-1).disparar(true))
const avanzar = (ms) => act(() => vi.advanceTimersByTime(ms))

const barberosApi = (n) => Array.from({ length: n }, (_, i) => ({ id: i }))

beforeEach(() => {
  observers.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('IntersectionObserver', IntersectionObserverFalso)
  simularMovimientoReducido(false)
  reiniciarCacheBarberos()
  vi.mocked(api.obtenerBarberos).mockReset()
  vi.mocked(api.obtenerBarberos).mockResolvedValue(barberosApi(12))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete window.matchMedia
})

describe('interpolar y formatearCifra', () => {
  it('devuelve 0 al inicio y el valor exacto al final', () => {
    expect(interpolar(0, 12)).toBe(0)
    expect(interpolar(1, 12)).toBe(12)
    expect(interpolar(1.5, 12)).toBe(12)
    expect(interpolar(-0.2, 12)).toBe(0)
  })

  it('sube de forma creciente con curva de salida suave', () => {
    const mitad = interpolar(0.5, 100)
    expect(mitad).toBeGreaterThan(50)
    expect(interpolar(0.25, 100)).toBeLessThan(mitad)
    expect(interpolar(0.75, 100)).toBeGreaterThan(mitad)
  })

  it('el formato final es exactamente "+6K", "12", "6" y "2"', () => {
    expect(formatearCifra({ prefijo: '+', valor: 6, sufijo: 'K' })).toBe('+6K')
    expect(formatearCifra({ valor: 12 })).toBe('12')
    expect(formatearCifra({ valor: 6 })).toBe('6')
    expect(formatearCifra({ valor: 2 })).toBe('2')
  })
})

describe('conteo en Estadisticas', () => {
  it('no empieza hasta que la sección es visible y llega a los valores finales', async () => {
    render(<Estadisticas />)
    await act(async () => {})

    avanzar(3000)
    expect(mostrados()).toEqual(['+0K', '0', '0', '0'])

    entrar()
    avanzar(300)
    expect(mostrados()).not.toEqual(['+0K', '0', '0', '0'])

    avanzar(2500)
    expect(mostrados()).toEqual(['+6K', '12', '6', '2'])
  })

  it('no se repite al volver a entrar', async () => {
    render(<Estadisticas />)
    await act(async () => {})
    entrar()
    avanzar(3000)

    expect(observers.at(-1).disconnect).toHaveBeenCalled()
    act(() => observers.at(-1).disparar(false))
    act(() => observers.at(-1).disparar(true))
    avanzar(100)
    expect(mostrados()).toEqual(['+6K', '12', '6', '2'])
  })

  it('empieza el conteo con el texto accesible solo con el valor final', async () => {
    render(<Estadisticas />)
    await act(async () => {})
    entrar()
    avanzar(300)

    expect(screen.getByText('+6K Clientes')).toBeInTheDocument()
    expect(screen.getByText('12 Barberos')).toBeInTheDocument()
    screen.getAllByTestId('cifra-animada').forEach((el) => {
      expect(el.closest('[aria-hidden="true"]')).not.toBeNull()
    })
  })

  it('la cifra de barberos no cuenta hasta tener el valor', async () => {
    let resolver
    vi.mocked(api.obtenerBarberos).mockReturnValue(new Promise((r) => { resolver = r }))
    render(<Estadisticas />)
    entrar()
    avanzar(3000)

    // Sin dato: solo 3 cifras visibles (la 4.ª es un hueco reservado y oculto)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByText('12 Barberos')).not.toBeInTheDocument()

    await act(async () => {
      resolver(barberosApi(12))
    })
    expect(screen.getByText('12 Barberos')).toBeInTheDocument()
    expect(mostrados()).toEqual(['+6K', '0', '6', '2'])

    avanzar(3000)
    expect(mostrados()).toEqual(['+6K', '12', '6', '2'])
  })

  it('con la API fallando quedan 3 cifras sin hueco', async () => {
    vi.mocked(api.obtenerBarberos).mockRejectedValue(new Error('sin conexión'))
    render(<Estadisticas />)
    await act(async () => {})

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByTestId('cifra-animada')).toHaveLength(3)
    expect(screen.queryByText('Barberos')).not.toBeInTheDocument()
  })

  it('con prefers-reduced-motion muestra el valor final sin animar', async () => {
    simularMovimientoReducido(true)
    render(<Estadisticas />)
    await act(async () => {})

    expect(mostrados()).toEqual(['+6K', '12', '6', '2'])
  })

  it('cancela el requestAnimationFrame al desmontar', async () => {
    const cancelar = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = render(<Estadisticas />)
    await act(async () => {})
    entrar()
    avanzar(300)

    unmount()
    expect(cancelar).toHaveBeenCalled()
  })
})

describe('useVisible', () => {
  const Prueba = () => {
    const [ref, visible] = useVisible(0.3)
    return <div ref={ref}>{visible ? 'visible' : 'oculto'}</div>
  }

  it('observa con threshold 0.3 y limpia el observer al desmontar', () => {
    const { unmount } = render(<Prueba />)
    const observer = observers.at(-1)

    expect(observer.observe).toHaveBeenCalled()
    expect(observer.opciones).toEqual({ threshold: 0.3 })
    expect(observer.disconnect).not.toHaveBeenCalled()

    unmount()
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('pasa a visible al intersectar y se desconecta', () => {
    render(<Prueba />)
    expect(screen.getByText('oculto')).toBeInTheDocument()

    entrar()
    expect(screen.getByText('visible')).toBeInTheDocument()
    expect(observers.at(-1).disconnect).toHaveBeenCalled()
  })
})
