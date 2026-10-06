import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import TarjetaServicio from '../components/ui/TarjetaServicio'
import { SERVICIOS_API, SERVICIO_GRATIS } from './fixturesServicios'
import { ProveedorCarrito } from '../context/CarritoContext'

const Ubicacion = () => {
  const { pathname, search } = useLocation()
  return <p data-testid="ubicacion">{pathname + search}</p>
}

const montar = (servicio, props = {}) =>
  render(
    <MemoryRouter initialEntries={['/cortes']}>
      <Routes>
        <Route path="/cortes" element={<ProveedorCarrito><TarjetaServicio servicio={servicio} {...props} /></ProveedorCarrito>} />
        <Route path="/reservar-corte" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => sessionStorage.clear())

describe('TarjetaServicio', () => {
  it('muestra categoría, tipo, nombre, descripción, duración y precio que vienen de la API', () => {
    montar(SERVICIOS_API[1]) // Corte degradado (Fade), élite

    expect(screen.getByText('Cortes')).toBeInTheDocument()
    expect(screen.getByText('Élite')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Corte degradado (Fade)' })).toBeInTheDocument()
    expect(screen.getByText('Descripción de Corte degradado (Fade)')).toBeInTheDocument()
    expect(screen.getByText(/40 min/)).toBeInTheDocument()
    expect(screen.getByText('$25.000')).toBeInTheDocument()
  })

  it('un servicio de precio 0 muestra "Gratis"', () => {
    montar(SERVICIO_GRATIS)

    expect(screen.getByText('Gratis')).toBeInTheDocument()
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument()
  })

  it('sin descripción no deja un párrafo vacío', () => {
    const { container } = montar({ ...SERVICIOS_API[0], descripcion: null })

    expect(screen.getByRole('heading', { name: 'Corte clásico' })).toBeInTheDocument()
    expect(container.querySelectorAll('p')).toHaveLength(1) // solo la fila de duración y precio
  })

  it('un servicio sin categoría se rotula como "Otros"', () => {
    montar({ ...SERVICIOS_API[0], categoria: null })
    expect(screen.getByText('Otros')).toBeInTheDocument()
  })

  it('el nivel del título es configurable (h4 bajo un encabezado de categoría)', () => {
    montar(SERVICIOS_API[0], { Titulo: 'h4' })
    expect(screen.getByRole('heading', { level: 4, name: 'Corte clásico' })).toBeInTheDocument()
  })

  it('"Reservar solo este" lleva a la reserva con ?servicio=<id> (camino rápido) y no toca la selección', async () => {
    const user = userEvent.setup()
    montar(SERVICIOS_API[3])

    const enlace = screen.getByRole('link', { name: 'Reservar solo este' })
    expect(enlace).toHaveAttribute('href', '/reservar-corte?servicio=4')
    await user.click(enlace)

    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/reservar-corte?servicio=4')
    expect(sessionStorage.getItem('seleccion-servicios')).toBeNull()
  })

  it('"Agregar a mi selección" alterna con "Quitar de mi selección" (aria-pressed, check y borde dorado)', async () => {
    const user = userEvent.setup()
    montar(SERVICIOS_API[0])

    const agregar = screen.getByRole('button', { name: 'Agregar a mi selección' })
    expect(agregar).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('✓')).not.toBeInTheDocument()

    await user.click(agregar)

    const quitar = screen.getByRole('button', { name: 'Quitar de mi selección' })
    expect(quitar).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(quitar.parentElement).toHaveClass('border-oro')
    expect(JSON.parse(sessionStorage.getItem('seleccion-servicios'))).toEqual([1])

    await user.click(quitar)

    expect(screen.getByRole('button', { name: 'Agregar a mi selección' })).toHaveAttribute('aria-pressed', 'false')
    expect(sessionStorage.getItem('seleccion-servicios')).toBeNull()
  })

  describe('reglas de la selección (varias tarjetas en el mismo carrito)', () => {
    const montarVarias = (servicios) =>
      render(
        <MemoryRouter>
          <ProveedorCarrito>
            {servicios.map((s) => (
              <TarjetaServicio key={s.id} servicio={s} />
            ))}
          </ProveedorCarrito>
        </MemoryRouter>
      )
    const botonDe = (nombre) => within(screen.getByRole('heading', { name: nombre }).parentElement).getByRole('button')

    it('con 3 elegidos, agregar un cuarto queda con aria-disabled, explicación visible y no suma', async () => {
      const user = userEvent.setup()
      montarVarias(SERVICIOS_API.slice(0, 4))
      await user.click(botonDe(SERVICIOS_API[0].nombre))
      await user.click(botonDe(SERVICIOS_API[1].nombre))
      await user.click(botonDe(SERVICIOS_API[2].nombre))

      const cuarto = botonDe(SERVICIOS_API[3].nombre)
      expect(cuarto).toHaveAttribute('aria-disabled', 'true')
      expect(cuarto).toHaveAccessibleDescription('Máximo 3 servicios por reserva')
      expect(screen.getByText('Máximo 3 servicios por reserva')).toBeVisible()

      await user.click(cuarto)
      expect(JSON.parse(sessionStorage.getItem('seleccion-servicios'))).toEqual([1, 2, 3])
      expect(cuarto).toHaveAttribute('aria-pressed', 'false')

      // Quitar uno vuelve a habilitar el cuarto.
      await user.click(botonDe(SERVICIOS_API[0].nombre))
      expect(botonDe(SERVICIOS_API[3].nombre)).not.toHaveAttribute('aria-disabled')
    })

    it('un servicio INDIVIDUAL de 300 min se puede agregar, pero sumarle otro (combo > 240 min) se bloquea y se explica', async () => {
      const user = userEvent.setup()
      const largo = { ...SERVICIOS_API[0], id: 50, nombre: 'Tratamiento largo', duracion_min: 300 }
      const corto = { ...SERVICIOS_API[3], id: 51, nombre: 'Detalle corto', duracion_min: 20 }
      montarVarias([largo, corto])

      expect(botonDe('Tratamiento largo')).not.toHaveAttribute('aria-disabled')
      await user.click(botonDe('Tratamiento largo'))
      expect(JSON.parse(sessionStorage.getItem('seleccion-servicios'))).toEqual([50])

      expect(botonDe('Detalle corto')).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByText(/240 min, el máximo para combos/)).toBeVisible()
      await user.click(botonDe('Detalle corto'))
      expect(JSON.parse(sessionStorage.getItem('seleccion-servicios'))).toEqual([50])
    })

    it('un combo exactamente de 240 min sí se permite', async () => {
      const user = userEvent.setup()
      const a = { ...SERVICIOS_API[0], id: 60, nombre: 'Largo A', duracion_min: 120 }
      const b = { ...SERVICIOS_API[3], id: 61, nombre: 'Largo B', duracion_min: 120 }
      montarVarias([a, b])
      await user.click(botonDe('Largo A'))
      expect(botonDe('Largo B')).not.toHaveAttribute('aria-disabled')
      await user.click(botonDe('Largo B'))
      expect(JSON.parse(sessionStorage.getItem('seleccion-servicios'))).toEqual([60, 61])
    })

    it('aviso suave de la misma categoría: se muestra pero NO bloquea', async () => {
      const user = userEvent.setup()
      montarVarias([SERVICIOS_API[0], SERVICIOS_API[1]]) // las dos son "Cortes"
      expect(screen.queryByText(/Ya tienes un servicio de Cortes/)).not.toBeInTheDocument()

      await user.click(botonDe(SERVICIOS_API[0].nombre))

      const segundo = botonDe(SERVICIOS_API[1].nombre)
      expect(screen.getByText('Ya tienes un servicio de Cortes; puedes continuar si quieres ambos.')).toBeVisible()
      expect(segundo).not.toHaveAttribute('aria-disabled')
      await user.click(segundo)
      expect(JSON.parse(sessionStorage.getItem('seleccion-servicios'))).toEqual([1, 2])
    })

    it('"Reservar solo este" no altera una selección ya hecha', async () => {
      const user = userEvent.setup()
      montarVarias([SERVICIOS_API[0], SERVICIOS_API[3]])
      await user.click(botonDe(SERVICIOS_API[0].nombre))
      const antes = sessionStorage.getItem('seleccion-servicios')
      await user.click(screen.getAllByRole('link', { name: 'Reservar solo este' })[1])
      expect(sessionStorage.getItem('seleccion-servicios')).toBe(antes)
    })
  })
})
