import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Paginacion from '../components/admin/Paginacion'
import { paginasVisibles, rangoMostrado, totalPaginas, ELIPSIS } from '../utils/paginacion'
import { esFechaISO } from '../utils/fechas'
import CambiarContrasena from '../components/dashboard/CambiarContrasena'

describe('paginasVisibles', () => {
  it('hasta 7 páginas se muestran todas', () => {
    expect(paginasVisibles(1, 1)).toEqual([1])
    expect(paginasVisibles(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it.each([
    [1, [1, 2, 3, 4, ELIPSIS, 29]],
    [3, [1, 2, 3, 4, ELIPSIS, 29]],
    [4, [1, ELIPSIS, 3, 4, 5, ELIPSIS, 29]],
    [5, [1, ELIPSIS, 4, 5, 6, ELIPSIS, 29]],
    [26, [1, ELIPSIS, 25, 26, 27, ELIPSIS, 29]],
    [27, [1, ELIPSIS, 26, 27, 28, 29]],
    [28, [1, ELIPSIS, 26, 27, 28, 29]],
    [29, [1, ELIPSIS, 26, 27, 28, 29]],
  ])('29 páginas, actual %i', (actual, esperado) => {
    expect(paginasVisibles(actual, 29)).toEqual(esperado)
  })

  it('con 8 páginas nunca repite números ni deja huecos sin puntos suspensivos', () => {
    for (let actual = 1; actual <= 8; actual += 1) {
      const lista = paginasVisibles(actual, 8)
      const numeros = lista.filter((p) => p !== ELIPSIS)
      expect(new Set(numeros).size).toBe(numeros.length)
      expect(numeros).toContain(actual)
      expect(numeros).toContain(1)
      expect(numeros).toContain(8)
    }
  })
})

describe('totalPaginas / rangoMostrado', () => {
  it('redondea hacia arriba y nunca baja de 1', () => {
    expect(totalPaginas(435, 15)).toBe(29)
    expect(totalPaginas(436, 15)).toBe(30)
    expect(totalPaginas(0, 15)).toBe(1)
  })

  it('rango "1–15 de 435", la última parcial y vacío', () => {
    expect(rangoMostrado(1, 15, 435)).toEqual({ inicio: 1, fin: 15 })
    expect(rangoMostrado(29, 15, 435)).toEqual({ inicio: 421, fin: 435 })
    expect(rangoMostrado(3, 15, 40)).toEqual({ inicio: 31, fin: 40 })
    expect(rangoMostrado(1, 15, 0)).toEqual({ inicio: 0, fin: 0 })
  })
})

describe('Paginacion', () => {
  it('llama a alCambiar con la página elegida y no hace nada con los deshabilitados', async () => {
    const alCambiar = vi.fn()
    render(<Paginacion pagina={1} total={435} limite={15} alCambiar={alCambiar} />)

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(alCambiar).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(alCambiar).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Página 29' }))
    expect(alCambiar).toHaveBeenLastCalledWith(29)
  })

  it('en la última página "Siguiente" queda deshabilitado y "Anterior" activo', () => {
    render(<Paginacion pagina={29} total={435} limite={15} alCambiar={() => {}} />)

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
  })

  it('los números no accesibles de móvil y los de escritorio comparten una sola barra con una sola "Anterior"', () => {
    render(<Paginacion pagina={2} total={435} limite={15} alCambiar={() => {}} />)

    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Anterior' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Siguiente' })).toHaveLength(1)
    // los números se ocultan en móvil con clases de Tailwind, y el texto compacto en escritorio
    expect(screen.getByRole('button', { name: 'Página 2' }).closest('li')).toHaveClass('hidden', 'sm:block')
    expect(within(screen.getByRole('navigation')).getByText('Página 2 de 29')).toHaveClass('sm:hidden')
  })
})

describe('esFechaISO', () => {
  it.each(['2026-10-04', '2024-02-29'])('acepta %s', (f) => expect(esFechaISO(f)).toBe(true))
  it.each(['2026-02-31', '2026-13-01', '2026-10-4', 'hoy', '', null, undefined, 20261004])(
    'rechaza %s',
    (f) => expect(esFechaISO(f)).toBe(false)
  )
})

describe('CambiarContrasena: variantes del botón', () => {
  it('el panel del barbero conserva su botón crema', () => {
    render(<CambiarContrasena token="t" />)
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toHaveClass('bg-amber-50')
  })

  it('el dashboard del admin usa el dorado del tema', () => {
    render(<CambiarContrasena token="t" variante="admin" />)
    const boton = screen.getByRole('button', { name: 'Guardar contraseña' })
    expect(boton).toHaveClass('bg-oro')
    expect(boton).not.toHaveClass('bg-amber-50')
  })
})
