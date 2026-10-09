import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Empleados from '../pages/admin/Empleados'
import Servicios from '../pages/admin/Servicios'
import { interpretarErrorEmpleado, unidadesDelMes } from '../utils/empleados'
import { interpretarError } from '../utils/erroresCatalogo'
import * as api from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { usuario: 'admin', rol: 'admin' } }),
}))

// Fase 7: selectores de área en /admin/empleados y /admin/servicios, etiquetas, filtro, categorías por área y mensajes de error.

const fallo = (codigo, mensaje = 'error', extra = {}) => Object.assign(new Error(mensaje), { codigo, ...extra })
const fijarEscritorio = (esEscritorio) => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: esEscritorio, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

beforeEach(() => fijarEscritorio(false))
afterEach(() => {
  delete window.matchMedia
  vi.restoreAllMocks()
})

// ------------------------------------------------------------------------------------------------ empleados
const empleado = (id, nombre, extra = {}) => ({
  id, nombre, cargo: 'Cargo', especialidad: null, foto: null, activo: true, area: 'barberia',
  usuario: { id: id * 10, usuario: nombre.toLowerCase(), activo: true }, usuarios_total: 1, cortes_mes: 4, citas_pendientes: 0,
  ...extra,
})
const EMPLEADOS = [empleado(1, 'Boby'), empleado(9, 'Camila', { area: 'asesoria', cortes_mes: 7, citas_pendientes: 2 })]

describe('Empleados: área', () => {
  const montarEmpleados = async () => {
    vi.mocked(api.obtenerEmpleados).mockResolvedValue(EMPLEADOS)
    vi.mocked(api.crearEmpleado).mockImplementation(async (_t, datos) => ({ id: 99, ...datos, activo: true }))
    vi.mocked(api.actualizarEmpleado).mockResolvedValue({})
    render(<MemoryRouter><Empleados /></MemoryRouter>)
    await screen.findByRole('group', { name: 'Estado' })
  }
  const tarjeta = (nombre) => screen.getByRole('heading', { name: new RegExp(`^${nombre}`) }).closest('article')

  it('cada empleado lleva su etiqueta de área y la cifra del mes se rotula según su área ("Cortes" / "Asesorías")', async () => {
    await montarEmpleados()
    expect(within(tarjeta('Boby')).getByText('Barbería')).toBeInTheDocument()
    expect(within(tarjeta('Boby')).getByText('Cortes este mes')).toBeInTheDocument()
    expect(within(tarjeta('Camila')).getByText('Asesoría')).toBeInTheDocument()
    expect(within(tarjeta('Camila')).getByText('Asesorías este mes')).toBeInTheDocument()
  })

  it('tabla (escritorio): columna Área, encabezado mixto y la unidad en la celda de quien atiende asesorías', async () => {
    fijarEscritorio(true)
    await montarEmpleados()
    const tabla = screen.getByRole('table', { name: 'Empleados' })
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toContain('Cortes / asesorías este mes')
    const fila = within(tabla).getByText('Camila').closest('tr')
    expect(within(fila).getByText('Asesoría')).toBeInTheDocument()
    expect(within(fila).getByText('asesorías')).toBeInTheDocument()
  })

  it('el formulario nuevo trae el selector de Área (barbería por defecto) con su frase de ayuda y manda lo elegido', async () => {
    await montarEmpleados()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo empleado' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo empleado' })
    const selector = within(dialogo).getByLabelText('Área')
    expect(selector).toHaveValue('barberia')
    expect(within(dialogo).getAllByRole('option').map((o) => o.textContent).slice(0, 2)).toEqual(['Barbería', 'Asesoría'])
    expect(within(dialogo).getByText(/Los asesores atienden solo asesorías y los barberos solo servicios de barbería/)).toBeInTheDocument()
    expect(selector).toHaveAccessibleDescription(/atienden solo asesorías/)

    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Nueva Asesora')
    await userEvent.selectOptions(selector, 'asesoria')
    await userEvent.type(within(dialogo).getByLabelText('Usuario de acceso'), 'nueva01')
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), 'clave-segura-1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear empleado' }))
    expect(api.crearEmpleado).toHaveBeenCalledWith('tok', expect.objectContaining({ nombre: 'Nueva Asesora', area: 'asesoria' }))
  })

  it('editar muestra el área actual y solo manda el área si cambió', async () => {
    await montarEmpleados()
    await userEvent.click(within(tarjeta('Camila')).getByRole('button', { name: 'Editar Camila' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar empleado' })
    expect(within(dialogo).getByLabelText('Área')).toHaveValue('asesoria')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Área'), 'barberia')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))
    expect(api.actualizarEmpleado).toHaveBeenCalledWith('tok', 9, { area: 'barberia' })
  })

  it('409 AREA_CON_CITAS_PENDIENTES: mensaje claro en el campo Área (role=alert), foco ahí, enlace a sus citas y el formulario sigue usable', async () => {
    await montarEmpleados()
    vi.mocked(api.actualizarEmpleado).mockRejectedValueOnce(
      fallo('AREA_CON_CITAS_PENDIENTES', 'texto del servidor', { campo: 'area', citas_pendientes: 2 })
    )
    await userEvent.click(within(tarjeta('Camila')).getByRole('button', { name: 'Editar Camila' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar empleado' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Área'), 'barberia')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    const alerta = await within(dialogo).findByRole('alert')
    expect(alerta).toHaveTextContent('No se puede cambiar el área: tiene 2 citas pendientes o futuras')
    expect(alerta).toHaveTextContent('no se guardó ningún cambio')
    const selector = within(dialogo).getByLabelText('Área')
    expect(selector).toHaveAttribute('aria-invalid', 'true')
    expect(selector).toHaveAccessibleDescription(/No se puede cambiar el área/)
    expect(selector).toHaveFocus()
    expect(within(dialogo).getByRole('link', { name: 'Ver y reasignar sus citas' })).toHaveAttribute('href', '/admin/citas?barbero=9&pestana=proximas')
    // El formulario sigue abierto y se puede reintentar: el botón no quedó bloqueado.
    expect(within(dialogo).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    await userEvent.selectOptions(selector, 'asesoria')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('interpretarErrorEmpleado: singular, plural y sin cantidad', () => {
    expect(interpretarErrorEmpleado(fallo('AREA_CON_CITAS_PENDIENTES', 'x', { citas_pendientes: 1 }))).toMatchObject({ campo: 'area' })
    expect(interpretarErrorEmpleado(fallo('AREA_CON_CITAS_PENDIENTES', 'x', { citas_pendientes: 1 })).mensaje).toContain('1 cita pendiente o futura')
    expect(interpretarErrorEmpleado(fallo('AREA_CON_CITAS_PENDIENTES', 'x')).mensaje).toContain('citas pendientes o futuras')
    expect(unidadesDelMes('asesoria')).toBe('asesorías')
    expect(unidadesDelMes('barberia')).toBe('cortes')
    expect(unidadesDelMes(undefined)).toBe('cortes')
  })
})

// ------------------------------------------------------------------------------------------------ servicios
const cat = (id, nombre, slug, area, activo = true) => ({ id, nombre, slug, orden: id, activo, area, total_servicios: 1, total_inactivos: 0 })
const CATEGORIAS = [cat(1, 'Cortes', 'cortes', 'barberia'), cat(2, 'Asesorías', 'asesorias', 'asesoria')]
const servicio = (id, nombre, categoria, extra = {}) => ({
  id, nombre, descripcion: `Descripción de ${nombre}`, precio: 18000, duracion_min: 30, tipo: 'original', activo: true,
  area: categoria.area, precio_fijo: false,
  categoria: { id: categoria.id, nombre: categoria.nombre, slug: categoria.slug, activo: categoria.activo, area: categoria.area },
  ...extra,
})
const SERVICIOS = [
  servicio(10, 'Corte clásico', CATEGORIAS[0]),
  servicio(20, 'Asesoría Premium', CATEGORIAS[1], { precio: 60000, duracion_min: 60, tipo: 'vip' }),
  servicio(21, 'Asesoría gratuita', CATEGORIAS[1], { precio: 0, duracion_min: 15, precio_fijo: true }),
]

describe('Servicios: área', () => {
  const montarServicios = async () => {
    vi.mocked(api.obtenerServiciosAdmin).mockResolvedValue(SERVICIOS)
    vi.mocked(api.obtenerCategoriasAdmin).mockResolvedValue(CATEGORIAS)
    vi.mocked(api.crearServicioAdmin).mockImplementation(async (_t, datos) => ({ id: 99, ...SERVICIOS[0], ...datos, categoria: { ...SERVICIOS[0].categoria } }))
    vi.mocked(api.actualizarServicioAdmin).mockImplementation(async (_t, id, cambios) => ({ ...SERVICIOS.find((s) => s.id === id), ...cambios }))
    render(<MemoryRouter><Servicios /></MemoryRouter>)
    await screen.findByRole('group', { name: 'Categoría' })
  }
  const tarjeta = (nombre) => screen.getByRole('heading', { name: nombre }).closest('article')
  const abrirNuevo = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo servicio' }))
    return screen.getByRole('dialog', { name: 'Nuevo servicio' })
  }
  const opciones = (select) => within(select).getAllByRole('option').map((o) => o.textContent)

  it('cada servicio muestra su etiqueta de área', async () => {
    await montarServicios()
    expect(within(tarjeta('Corte clásico')).getByText('Barbería')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Asesorías' }))
    expect(within(tarjeta('Asesoría Premium')).getByText('Asesoría')).toBeInTheDocument()
  })

  it('el filtro «Área» deja solo los servicios y las categorías de esa área; «Todas las áreas» y «Limpiar filtros» lo quitan', async () => {
    await montarServicios()
    const filtro = screen.getByLabelText('Área')
    expect(opciones(filtro)).toEqual(['Todas las áreas', 'Barbería', 'Asesoría'])
    const chips = () => within(screen.getByRole('group', { name: 'Categoría' })).getAllByRole('button').map((b) => b.textContent)
    expect(chips()).toEqual(['Todas', 'Cortes', 'Asesorías'])

    await userEvent.selectOptions(filtro, 'asesoria')
    expect(chips()).toEqual(['Todas', 'Asesorías'])
    expect(screen.getByText('Asesoría Premium')).toBeInTheDocument()
    expect(screen.queryByText('Corte clásico')).toBeNull()

    await userEvent.selectOptions(filtro, 'barberia')
    expect(chips()).toEqual(['Todas', 'Cortes'])
    expect(screen.getByText('Corte clásico')).toBeInTheDocument()
    expect(screen.queryByText('Asesoría Premium')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByLabelText('Área')).toHaveValue('')
  })

  it('tabla (escritorio): columna Área con la etiqueta de cada servicio', async () => {
    fijarEscritorio(true)
    await montarServicios()
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))
    const tabla = screen.getByRole('table', { name: 'Servicios del catálogo' })
    expect(within(tabla).getByRole('columnheader', { name: 'Área' })).toBeInTheDocument()
    expect(within(within(tabla).getByText('Asesoría Premium').closest('tr')).getByText('Asesoría')).toBeInTheDocument()
  })

  it('el selector de categoría ofrece SOLO las del área elegida y al cambiar de área se limpia la categoría de la otra', async () => {
    await montarServicios()
    const dialogo = await abrirNuevo()
    const area = within(dialogo).getByLabelText('Área')
    const categoria = within(dialogo).getByLabelText('Categoría')
    expect(area).toHaveValue('barberia')
    expect(opciones(categoria)).toEqual(['Selecciona una categoría', 'Cortes'])

    await userEvent.selectOptions(categoria, '1')
    await userEvent.selectOptions(area, 'asesoria')
    expect(opciones(categoria)).toEqual(['Selecciona una categoría', 'Asesorías'])
    expect(categoria).toHaveValue('') // la categoría de barbería ya no vale
  })

  it('crea una asesoría: manda area y una categoría de asesoría, y el aviso dice dónde se ve', async () => {
    await montarServicios()
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Asesoría nueva')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Área'), 'asesoria')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Categoría'), '2')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo'), 'elite')
    await userEvent.type(within(dialogo).getByLabelText('Precio (COP)'), '50000')
    await userEvent.type(within(dialogo).getByLabelText('Duración (minutos)'), '30')
    await userEvent.type(within(dialogo).getByLabelText('Descripción'), 'Una asesoría')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear servicio' }))

    expect(api.crearServicioAdmin).toHaveBeenCalledWith('tok', expect.objectContaining({ nombre: 'Asesoría nueva', area: 'asesoria', categoria_id: 2 }))
    expect(await screen.findByRole('status')).toHaveTextContent('Ya se ve en «Añadir una asesoría» de la reserva')
  })

  it('editar la asesoría gratuita: el precio queda deshabilitado con su explicación', async () => {
    await montarServicios()
    await userEvent.click(screen.getByRole('button', { name: 'Asesorías' }))
    await userEvent.click(within(tarjeta('Asesoría gratuita')).getByRole('button', { name: 'Editar Asesoría gratuita' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar servicio' })
    const precio = within(dialogo).getByLabelText('Precio (COP)')
    expect(precio).toBeDisabled()
    expect(precio).toHaveAccessibleDescription(/siempre cuesta 0/)
    expect(within(dialogo).getByLabelText('Área')).toHaveValue('asesoria')
    // Otro servicio de asesoría sí deja editar el precio.
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(within(tarjeta('Asesoría Premium')).getByRole('button', { name: 'Editar Asesoría Premium' }))
    expect(within(screen.getByRole('dialog', { name: 'Editar servicio' })).getByLabelText('Precio (COP)')).toBeEnabled()
  })

  it.each([
    ['SERVICIO_CON_HISTORIAL', 'area', 'Área', /ya tiene citas, así que no se puede cambiar su área/],
    ['CATEGORIA_AREA_INCOMPATIBLE', 'categoria_id', 'Categoría', /es de otra área/],
  ])('el 409/400 %s se muestra en el campo %s, con foco, y el formulario sigue abierto', async (codigo, campo, etiqueta, mensaje) => {
    await montarServicios()
    vi.mocked(api.actualizarServicioAdmin).mockRejectedValueOnce(fallo(codigo, 'texto del servidor', { campo }))
    await userEvent.click(within(tarjeta('Corte clásico')).getByRole('button', { name: 'Editar Corte clásico' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar servicio' })
    await userEvent.clear(within(dialogo).getByLabelText('Nombre'))
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Corte otro')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    const alerta = await within(dialogo).findByRole('alert')
    expect(alerta).toHaveTextContent(mensaje)
    const campoEl = within(dialogo).getByLabelText(etiqueta)
    expect(campoEl).toHaveAttribute('aria-invalid', 'true')
    expect(campoEl).toHaveFocus()
    expect(within(dialogo).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('interpretarError: PRECIO_FIJO va al campo precio', () => {
    expect(interpretarError(fallo('PRECIO_FIJO'))).toMatchObject({ campo: 'precio' })
    expect(interpretarError(fallo('SERVICIO_CON_HISTORIAL'))).toMatchObject({ campo: 'area' })
    expect(interpretarError(fallo('CATEGORIA_AREA_INCOMPATIBLE'))).toMatchObject({ campo: 'categoria_id' })
  })
})
