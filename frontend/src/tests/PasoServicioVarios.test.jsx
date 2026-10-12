import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PasoServicio from '../components/sections/reserva/PasoServicio'

const CORTES = { id: 1, nombre: 'Cortes', slug: 'cortes' }

const s = (id, nombre, duracion_min, precio = 10000, categoria = CORTES) => ({
  id,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  tipo: 'original',
  duracion_min,
  precio,
  categoria,
})

const LISTA = [s(1, 'Corte uno', 30), s(2, 'Corte dos', 30), s(3, 'Corte tres', 30), s(4, 'Corte cuatro', 30)]

const tarjeta = (nombre) => screen.getByRole('heading', { name: nombre }).closest('button')

const Controlado = ({ servicios = LISTA, inicial = [], onCambio }) => {
  const [ids, setIds] = useState(inicial)
  return (
    <PasoServicio
      servicios={servicios}
      idsSeleccionados={ids}
      onSeleccionar={(nuevos) => {
        onCambio?.(nuevos)
        setIds(nuevos)
      }}
    />
  )
}

describe('PasoServicio: multiselección', () => {
  it('permite elegir varios servicios y los marca todos (aria-pressed y check)', async () => {
    const user = userEvent.setup()
    const onCambio = vi.fn()
    render(<Controlado onCambio={onCambio} />)

    await user.click(tarjeta('Corte uno'))
    await user.click(tarjeta('Corte dos'))

    expect(onCambio).toHaveBeenLastCalledWith([1, 2]) // en el orden en que se eligieron
    expect(tarjeta('Corte uno')).toHaveAttribute('aria-pressed', 'true')
    expect(tarjeta('Corte dos')).toHaveAttribute('aria-pressed', 'true')
    expect(within(tarjeta('Corte uno')).getByText('✓')).toBeInTheDocument()
    expect(tarjeta('Corte tres')).toHaveAttribute('aria-pressed', 'false')
  })

  it('volver a tocar un servicio elegido lo quita', async () => {
    const user = userEvent.setup()
    const onCambio = vi.fn()
    render(<Controlado inicial={[1, 2]} onCambio={onCambio} />)

    await user.click(tarjeta('Corte uno'))

    expect(onCambio).toHaveBeenLastCalledWith([2])
    expect(tarjeta('Corte uno')).toHaveAttribute('aria-pressed', 'false')
  })

  it('con 3 elegidos el cuarto queda con aria-disabled, motivo visible enlazado y no se agrega', async () => {
    const user = userEvent.setup()
    const onCambio = vi.fn()
    render(<Controlado inicial={[1, 2, 3]} onCambio={onCambio} />)

    const cuarto = tarjeta('Corte cuatro')
    expect(cuarto).toHaveAttribute('aria-disabled', 'true')
    expect(cuarto).toHaveAccessibleDescription('Máximo 3 servicios por reserva')
    expect(screen.getByText('Máximo 3 servicios por reserva')).toBeVisible()

    await user.click(cuarto)
    expect(onCambio).not.toHaveBeenCalled()
    expect(cuarto).toHaveAttribute('aria-pressed', 'false')

    // Los elegidos no se bloquean: se pueden quitar
    expect(tarjeta('Corte uno')).not.toHaveAttribute('aria-disabled')
    await user.click(tarjeta('Corte uno'))
    expect(tarjeta('Corte cuatro')).not.toHaveAttribute('aria-disabled')
  })

  it('el tope de 240 min aplica a combos: bloquea con el motivo; un servicio individual de 300 min no se bloquea', async () => {
    const user = userEvent.setup()
    const largo = s(10, 'Tratamiento largo', 300)
    const corto = s(11, 'Detalle corto', 20)
    const onCambio = vi.fn()
    render(<Controlado servicios={[largo, corto]} onCambio={onCambio} />)

    expect(tarjeta('Tratamiento largo')).not.toHaveAttribute('aria-disabled') // individual: nunca bloqueado
    await user.click(tarjeta('Tratamiento largo'))

    const bloqueado = tarjeta('Detalle corto')
    expect(bloqueado).toHaveAttribute('aria-disabled', 'true')
    expect(bloqueado).toHaveAccessibleDescription(/240 min, el máximo para combos/)
    await user.click(bloqueado)
    expect(onCambio).toHaveBeenCalledTimes(1)
  })

  it('240 min exactos se permiten', async () => {
    const user = userEvent.setup()
    render(<Controlado servicios={[s(20, 'Largo A', 120), s(21, 'Largo B', 120)]} />)
    await user.click(tarjeta('Largo A'))
    expect(tarjeta('Largo B')).not.toHaveAttribute('aria-disabled')
    await user.click(tarjeta('Largo B'))
    expect(tarjeta('Largo B')).toHaveAttribute('aria-pressed', 'true')
  })

  it('aviso suave de misma categoría: visible, enlazado, y NO bloquea', async () => {
    const user = userEvent.setup()
    render(<Controlado inicial={[1]} />)

    const segundo = tarjeta('Corte dos')
    expect(segundo).not.toHaveAttribute('aria-disabled')
    expect(segundo).toHaveAccessibleDescription('Ya tienes un servicio de Cortes; puedes continuar si quieres ambos.')
    await user.click(segundo)
    expect(segundo).toHaveAttribute('aria-pressed', 'true')
  })

  it('sin servicios elegidos no hay avisos ni bloqueos', () => {
    render(<Controlado />)
    expect(screen.queryByText(/Máximo 3|Ya tienes un servicio/)).not.toBeInTheDocument()
    LISTA.forEach((servicio) => expect(tarjeta(servicio.nombre)).not.toHaveAttribute('aria-disabled'))
  })

  it('invita a elegir hasta 3 servicios', () => {
    render(<Controlado />)
    expect(screen.getByText(/Elige hasta 3 servicios/)).toBeInTheDocument()
  })
})
