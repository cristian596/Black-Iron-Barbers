import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Estadisticas from '../components/sections/Estadisticas'
import Hero from '../components/sections/Hero'
import * as api from '../services/api'
import { reiniciarCacheBarberos } from '../hooks/useCantidadBarberos'

vi.mock('../services/api')

const lista = () => screen.getByRole('list')

describe('Estadisticas', () => {
  beforeEach(() => {
    reiniciarCacheBarberos()
    vi.mocked(api.obtenerBarberos).mockReset()
  })

  it('muestra 4 cifras con la cantidad de barberos de la API', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: i })))
    render(<Estadisticas />)

    expect(await screen.findByText('12 Barberos')).toBeInTheDocument()
    expect(screen.getByText('+6K Clientes')).toBeInTheDocument()
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('region', { name: 'Cifras de la barbería' })).toBeInTheDocument()
  })

  it('con la API fallando muestra solo 3 cifras', async () => {
    vi.mocked(api.obtenerBarberos).mockRejectedValue(new Error('sin conexión'))
    render(<Estadisticas />)

    // Mientras carga hay un hueco reservado (li aria-hidden con "Barberos"): su desaparición es la señal de que
    // la carga terminó. Esperar solo a la llamada a la API no basta, el fallo aún no se ha reflejado en el estado.
    await waitFor(() => expect(screen.queryByText('Barberos')).not.toBeInTheDocument())
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByText('Barberos')).not.toBeInTheDocument()
  })

  it('con 0 barberos tampoco deja hueco', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([])
    render(<Estadisticas />)

    // Con hidden: true se cuenta también el hueco reservado (4 mientras carga, 3 al terminar): sin esto la
    // aserción daba 3 antes y después de la carga.
    await waitFor(() => expect(within(lista()).getAllByRole('listitem', { hidden: true })).toHaveLength(3))
    expect(within(lista()).getAllByRole('listitem')).toHaveLength(3)
  })

  it('hero y estadísticas hacen una sola llamada a la API', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 1 }, { id: 2 }])
    render(
      <MemoryRouter>
        <Hero />
        <Estadisticas />
      </MemoryRouter>
    )

    await screen.findByText('2 barberos')
    expect(api.obtenerBarberos).toHaveBeenCalledTimes(1)
  })
})
