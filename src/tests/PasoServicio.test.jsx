import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PasoServicio from '../components/sections/reserva/PasoServicio'

const CORTES = { id: 1, nombre: 'Cortes', slug: 'cortes' }
const COMBOS = { id: 2, nombre: 'Combos', slug: 'combos' }
const ROSTRO = { id: 3, nombre: 'Rostro', slug: 'rostro' }

const servicio = (id, nombre, tipo, duracion_min, precio, categoria) => ({
  id,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  tipo,
  duracion_min,
  precio,
  categoria,
})

const SERVICIOS = [
  servicio(1, 'Corte de Cabello', 'original', 35, 55000, CORTES),
  servicio(2, 'Corte de Barba', 'elite', 45, 48000, CORTES),
  servicio(3, 'Combo (Pelo + Barba)', 'vip', 90, 103000, COMBOS),
  servicio(4, 'Perfilado de Cejas', 'original', 15, 25000, ROSTRO),
]

// Las descripciones mencionan otros servicios, así que buscar por el título exacto (heading) y subir
// al botón evita falsos positivos por coincidencias parciales en el nombre accesible del botón completo.
const tarjetaDe = (nombreServicio) => screen.getByRole('heading', { name: nombreServicio }).closest('button')
const grupoCategorias = () => screen.getByRole('group', { name: 'Categoría' })
const grupoTipos = () => screen.getByRole('group', { name: 'Tipo de servicio' })
const chipCategoria = (nombre) => within(grupoCategorias()).getByRole('button', { name: nombre })
const chipTipo = (nombre) => within(grupoTipos()).getByRole('button', { name: nombre })
const buscador = () => screen.getByLabelText('Buscar servicio')

const montar = (props = {}) =>
  render(<PasoServicio servicios={SERVICIOS} idsSeleccionados={[]} onSeleccionar={vi.fn()} {...props} />)

// El paso es controlado por su padre; este contenedor imita ese comportamiento.
const Controlado = ({ inicial = [] }) => {
  const [ids, setIds] = useState(inicial)
  return <PasoServicio servicios={SERVICIOS} idsSeleccionados={ids} onSeleccionar={setIds} />
}

describe('PasoServicio', () => {
  it('muestra una tarjeta por cada servicio con duración y precio', () => {
    montar()

    expect(tarjetaDe('Corte de Cabello')).toBeInTheDocument()
    expect(screen.getByText('35 min')).toBeInTheDocument()
    expect(screen.getByText('$55.000')).toBeInTheDocument()
  })

  it('marca como seleccionada la tarjeta cuyo id coincide (aria-pressed y check visible)', () => {
    montar({ idsSeleccionados: [2] })

    expect(tarjetaDe('Corte de Barba')).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetaDe('Corte de Cabello')).toHaveAttribute('aria-pressed', 'false')
    expect(within(tarjetaDe('Corte de Barba')).getByText('✓')).toBeInTheDocument()
  })

  it('llama a onSeleccionar con el id del servicio al hacer clic', async () => {
    const user = userEvent.setup()
    const onSeleccionar = vi.fn()
    montar({ onSeleccionar })

    await user.click(chipCategoria('Rostro')) // la categoría inicial es Cortes
    await user.click(screen.getByRole('button', { name: /perfilado de cejas/i }))

    expect(onSeleccionar).toHaveBeenCalledWith([4]) // ahora recibe la lista de ids elegidos
  })

  it('muestra los chips de categoría con aria-pressed y filtra al elegir una', async () => {
    const user = userEvent.setup()
    montar()

    expect(grupoCategorias()).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(chipCategoria('Cortes')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /corte de barba/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /perfilado de cejas/i })).not.toBeInTheDocument()

    await user.click(chipCategoria('Rostro'))

    expect(chipCategoria('Rostro')).toHaveAttribute('aria-pressed', 'true')
    expect(chipCategoria('Cortes')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /perfilado de cejas/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /corte de barba/i })).not.toBeInTheDocument()
  })

  it('siempre muestra los filtros, aun con pocas categorías', () => {
    montar({ servicios: [SERVICIOS[0], SERVICIOS[2]] }) // Cortes y Combos → 2 categorías

    expect(grupoCategorias()).toBeInTheDocument()
    expect(grupoTipos()).toBeInTheDocument()
  })

  it('muestra un mensaje si no hay servicios', () => {
    montar({ servicios: [] })

    expect(screen.getByText(/no hay servicios disponibles/i)).toBeInTheDocument()
  })
})

describe('PasoServicio — filtros, buscador y agrupación', () => {
  it('empieza en la primera categoría (Cortes)', () => {
    montar()

    expect(chipCategoria('Cortes')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Corte de Cabello' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Combo (Pelo + Barba)' })).not.toBeInTheDocument()
  })

  it('empieza en la categoría del servicio ya seleccionado (por ejemplo, el de ?servicio=)', () => {
    montar({ idsSeleccionados: [4] })

    expect(chipCategoria('Rostro')).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetaDe('Perfilado de Cejas')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Corte de Cabello' })).not.toBeInTheDocument()
  })

  it('con "Todos" muestra cada categoría con su <h3> y los nombres pasan a <h4>', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(chipCategoria('Todos'))

    ;['Cortes', 'Combos', 'Rostro'].forEach((nombre) => {
      expect(screen.getByRole('heading', { level: 3, name: nombre })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 4, name: 'Perfilado de Cejas' })).toBeInTheDocument()
  })

  it('con una sola categoría elegida no hay encabezados de grupo y los nombres son <h3>', () => {
    montar()

    expect(screen.getByRole('heading', { level: 3, name: 'Corte de Cabello' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Cortes' })).not.toBeInTheDocument()
  })

  it('el filtro de tipo se combina con la categoría', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(chipTipo(/Élite/))

    expect(chipTipo(/Élite/)).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetaDe('Corte de Barba')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Corte de Cabello' })).not.toBeInTheDocument()
  })

  it('el buscador tiene etiqueta visible y busca sin distinguir mayúsculas ni tildes', async () => {
    const user = userEvent.setup()
    montar({
      servicios: [servicio(9, 'Corte clásico', 'original', 30, 18000, CORTES), ...SERVICIOS],
    })

    expect(buscador()).toBeVisible()
    await user.type(buscador(), 'CLASICO')

    expect(screen.getByRole('heading', { name: 'Corte clásico' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Corte de Cabello' })).not.toBeInTheDocument()
  })

  it('mientras hay texto en el buscador recorre todas las categorías; al borrarlo vuelve la elegida', async () => {
    const user = userEvent.setup()
    montar()

    await user.type(buscador(), 'cejas') // vive en Rostro, pero la categoría activa es Cortes
    expect(screen.getByRole('heading', { name: 'Perfilado de Cejas' })).toBeInTheDocument()
    expect(screen.getByText(/buscando en todas las categorías/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }))

    expect(buscador()).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Perfilado de Cejas' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Corte de Cabello' })).toBeInTheDocument()
    expect(chipCategoria('Cortes')).toHaveAttribute('aria-pressed', 'true')
  })

  it('el botón de borrar solo aparece cuando hay texto', async () => {
    const user = userEvent.setup()
    montar()

    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument()
    await user.type(buscador(), 'a')
    expect(screen.getByRole('button', { name: 'Borrar búsqueda' })).toBeInTheDocument()
  })

  it('sin resultados muestra el aviso y "Limpiar filtros" restablece búsqueda, tipo y categoría', async () => {
    const user = userEvent.setup()
    montar()

    await user.type(buscador(), 'zzzz')
    expect(screen.getByText('No encontramos servicios con esos filtros.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(buscador()).toHaveValue('')
    expect(chipTipo('Todos')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Corte de Cabello' })).toBeInTheDocument()
  })

  it('un servicio de precio 0 se muestra como "Gratis"', () => {
    montar({ servicios: [servicio(8, 'Asesoría gratuita', 'original', 15, 0, CORTES)] })

    expect(screen.getByText('Gratis')).toBeInTheDocument()
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
  })
})

describe('PasoServicio — la selección sobrevive a los filtros', () => {
  it('si el servicio elegido queda fuera del filtro sigue seleccionado al volver', async () => {
    const user = userEvent.setup()
    render(<Controlado />)

    await user.click(tarjetaDe('Corte de Cabello'))
    expect(tarjetaDe('Corte de Cabello')).toHaveAttribute('aria-pressed', 'true')

    await user.click(chipCategoria('Rostro')) // su tarjeta ya no está a la vista
    expect(screen.queryByRole('heading', { name: 'Corte de Cabello' })).not.toBeInTheDocument()

    await user.click(chipCategoria('Cortes'))
    expect(tarjetaDe('Corte de Cabello')).toHaveAttribute('aria-pressed', 'true')
  })

  it('una búsqueda que oculta el servicio elegido tampoco lo deselecciona', async () => {
    const user = userEvent.setup()
    render(<Controlado inicial={[1]} />)

    await user.type(buscador(), 'cejas')
    expect(screen.queryByRole('heading', { name: 'Corte de Cabello' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }))
    expect(tarjetaDe('Corte de Cabello')).toHaveAttribute('aria-pressed', 'true')
  })
})
