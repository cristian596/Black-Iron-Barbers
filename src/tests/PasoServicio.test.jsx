import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PasoServicio from '../components/sections/reserva/PasoServicio'

const SERVICIOS = [
  { id: 1, nombre: 'Corte de Cabello', duracion_min: 35, precio: 55000 },
  { id: 2, nombre: 'Corte de Barba', duracion_min: 45, precio: 48000 },
  { id: 3, nombre: 'Combo (Pelo + Barba)', duracion_min: 90, precio: 103000 },
  { id: 4, nombre: 'Perfilado de Cejas', duracion_min: 15, precio: 25000 },
]

// Las descripciones mencionan otros servicios ("...corte de cabello y barba..."),
// así que buscar por el título exacto (heading) y subir al botón evita falsos positivos
// por coincidencias parciales en el nombre accesible del botón completo.
const tarjetaDe = (nombreServicio) => screen.getByRole('heading', { name: nombreServicio }).closest('button')

describe('PasoServicio', () => {
  it('muestra una tarjeta por cada servicio con duración y precio', () => {
    render(<PasoServicio servicios={SERVICIOS} servicioIdSeleccionado="" onSeleccionar={vi.fn()} />)

    expect(tarjetaDe('Corte de Cabello')).toBeInTheDocument()
    expect(screen.getByText('35 min')).toBeInTheDocument()
    expect(screen.getByText('55.000')).toBeInTheDocument()
  })

  it('marca como seleccionada la tarjeta cuyo id coincide (aria-pressed y check visible)', () => {
    render(<PasoServicio servicios={SERVICIOS} servicioIdSeleccionado={2} onSeleccionar={vi.fn()} />)

    expect(tarjetaDe('Corte de Barba')).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetaDe('Corte de Cabello')).toHaveAttribute('aria-pressed', 'false')
  })

  it('llama a onSeleccionar con el id del servicio al hacer clic', async () => {
    const user = userEvent.setup()
    const onSeleccionar = vi.fn()
    render(<PasoServicio servicios={SERVICIOS} servicioIdSeleccionado="" onSeleccionar={onSeleccionar} />)

    await user.click(screen.getByRole('button', { name: /perfilado de cejas/i }))

    expect(onSeleccionar).toHaveBeenCalledWith(4)
  })

  it('con 3 o más categorías distintas, muestra pestañas y filtra al elegir una', async () => {
    const user = userEvent.setup()
    render(<PasoServicio servicios={SERVICIOS} servicioIdSeleccionado="" onSeleccionar={vi.fn()} />)

    const tabs = screen.getByRole('tablist', { name: /categorías de servicios/i })
    expect(tabs).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Barba' }))

    expect(screen.getByRole('button', { name: /corte de barba/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /perfilado de cejas/i })).not.toBeInTheDocument()
  })

  it('con menos de 3 categorías, no muestra pestañas', () => {
    const pocos = [SERVICIOS[0], SERVICIOS[2]] // Cabello, Combos → 2 categorías
    render(<PasoServicio servicios={pocos} servicioIdSeleccionado="" onSeleccionar={vi.fn()} />)

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('muestra un mensaje si no hay servicios', () => {
    render(<PasoServicio servicios={[]} servicioIdSeleccionado="" onSeleccionar={vi.fn()} />)

    expect(screen.getByText(/no hay servicios disponibles/i)).toBeInTheDocument()
  })
})
