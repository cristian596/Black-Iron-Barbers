import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ErrorCarga from '../components/ui/ErrorCarga'

describe('ErrorCarga', () => {
  it('anuncia el error (role="alert") y ofrece "Reintentar"', () => {
    render(<ErrorCarga mensaje="No se pudo conectar con el servidor" onReintentar={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('"Reintentar" llama al manejador una vez por clic', async () => {
    const user = userEvent.setup()
    const onReintentar = vi.fn()
    render(<ErrorCarga mensaje="Falló" onReintentar={onReintentar} />)

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onReintentar).toHaveBeenCalledTimes(1)
  })

  it('admite la variante oscura del catálogo (texto claro) sin cambiar el contenido', () => {
    render(<ErrorCarga mensaje="Falló" onReintentar={vi.fn()} variante="oscuro" />)

    expect(screen.getByText('Falló')).toHaveClass('text-white')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
