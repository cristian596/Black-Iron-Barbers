import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Servicios from '../pages/admin/Servicios'
import * as api from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { usuario: 'admin', rol: 'admin' } }),
}))

const cat = (id, nombre, slug, orden, activo = true, total = 0, inactivos = 0) => ({
  id, nombre, slug, orden, activo, total_servicios: total, total_inactivos: inactivos,
})
const CATEGORIAS = [
  cat(1, 'Cortes', 'cortes', 1, true, 2, 0),
  cat(2, 'Barba', 'barba', 2, true, 1, 0),
  cat(3, 'Vacía', 'vacia', 3, false, 0, 0),
]

const servicio = (id, nombre, categoria, tipo, precio, duracion, activo = true) => ({
  id,
  nombre,
  descripcion: categoria ? `Descripción de ${nombre}` : null,
  precio,
  duracion_min: duracion,
  tipo,
  activo,
  categoria: categoria && { id: categoria.id, nombre: categoria.nombre, slug: categoria.slug, activo: categoria.activo },
})
const SERVICIOS = [
  servicio(10, 'Corte clásico', CATEGORIAS[0], 'original', 18000, 30),
  servicio(11, 'Corte militar', CATEGORIAS[0], 'vip', 0, 25, false),
  servicio(12, 'Perfilado de barba', CATEGORIAS[1], 'elite', 12000, 20),
  servicio(13, 'Corte de Cabello', null, null, 55000, 35, false), // catálogo anterior
]

const fallo = (codigo, mensaje = 'error', extra = {}) => Object.assign(new Error(mensaje), { codigo, ...extra })

const fijarEscritorio = (esEscritorio) => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: esEscritorio, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

const montar = () => render(<MemoryRouter><Servicios /></MemoryRouter>)
const esperarCarga = () => screen.findByRole('group', { name: 'Categoría' })
const tarjeta = (nombre) => screen.getByRole('heading', { name: nombre }).closest('article')

beforeEach(() => {
  vi.mocked(api.obtenerServiciosAdmin).mockResolvedValue(SERVICIOS)
  vi.mocked(api.obtenerCategoriasAdmin).mockResolvedValue(CATEGORIAS)
  vi.mocked(api.actualizarServicioAdmin).mockImplementation(async (_t, id, cambios) => ({
    ...SERVICIOS.find((s) => s.id === id), ...cambios,
  }))
  vi.mocked(api.crearServicioAdmin).mockImplementation(async (_t, datos) => ({
    id: 99, ...datos, activo: true, categoria: { id: datos.categoria_id, nombre: 'Cortes', slug: 'cortes', activo: true },
  }))
})

afterEach(() => {
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('Servicios: carga, categorías y filtros', () => {
  it('pide servicios y categorías con el token y, como el catálogo público, muestra una sola categoría por defecto', async () => {
    montar()
    await esperarCarga()

    expect(api.obtenerServiciosAdmin).toHaveBeenCalledWith('tok')
    expect(api.obtenerCategoriasAdmin).toHaveBeenCalledWith('tok')
    expect(screen.getByRole('heading', { level: 1, name: 'Servicios' })).toBeInTheDocument()
    const chips = within(screen.getByRole('group', { name: 'Categoría' }))
    expect(chips.getByRole('button', { name: 'Cortes' })).toHaveAttribute('aria-pressed', 'true')
    expect(chips.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Corte clásico' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Perfilado de barba' })).toBeNull()
  })

  it('los chips incluyen las categorías vacías o inactivas (marcadas) y "Otros" para el catálogo anterior', async () => {
    montar()
    await esperarCarga()
    const chips = within(screen.getByRole('group', { name: 'Categoría' }))

    expect(chips.getByRole('button', { name: /Vacía/ })).toHaveTextContent('(inactiva)')
    await userEvent.click(chips.getByRole('button', { name: 'Otros' }))
    expect(screen.getByRole('heading', { name: 'Corte de Cabello' })).toBeInTheDocument()
  })

  it('"Todas" muestra todos los servicios, activos e inactivos', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))

    for (const nombre of ['Corte clásico', 'Corte militar', 'Perfilado de barba', 'Corte de Cabello']) {
      expect(screen.getByRole('heading', { name: nombre })).toBeInTheDocument()
    }
  })

  it('filtra por tipo y por estado, y el buscador busca en todas las categorías', async () => {
    montar()
    await esperarCarga()

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'inactivos')
    expect(screen.getByRole('heading', { name: 'Corte militar' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Corte clásico' })).toBeNull()

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'todos')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'vip')
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'todos')
    await userEvent.type(screen.getByLabelText('Buscar'), 'perfil')
    expect(screen.getByRole('heading', { name: 'Perfilado de barba' })).toBeInTheDocument() // de otra categoría
    expect(screen.getByText('Buscando en todas las categorías')).toBeInTheDocument()
  })

  it('sin resultados ofrece "Limpiar filtros", que restablece todo', async () => {
    montar()
    await esperarCarga()
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzzz')

    expect(await screen.findByText('No hay servicios con esos filtros.')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' }).at(-1))

    expect(screen.getByLabelText('Buscar')).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Corte clásico' })).toBeInTheDocument()
  })
})

describe('Servicios: tarjetas (móvil) y tabla (escritorio)', () => {
  it('móvil: tarjeta con insignia de tipo, precio con formatearPrecio ("Gratis" si es 0), duración e interruptor', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))

    const clasico = within(tarjeta('Corte clásico'))
    expect(clasico.getByText('Original')).toBeInTheDocument()
    expect(clasico.getByText('$18.000')).toBeInTheDocument()
    expect(clasico.getByText('30 min')).toBeInTheDocument()
    expect(clasico.getByRole('switch', { name: 'Desactivar Corte clásico' })).toHaveAttribute('aria-checked', 'true')

    const militar = within(tarjeta('Corte militar'))
    expect(militar.getByText('Gratis')).toBeInTheDocument()
    expect(militar.getByRole('switch', { name: 'Activar Corte militar' })).toHaveAttribute('aria-checked', 'false')
    expect(tarjeta('Corte militar')).toHaveClass('opacity-60') // inactivo atenuado
    expect(militar.getByText('Inactivo')).toBeInTheDocument() // y con etiqueta de texto
  })

  it('el interruptor y el botón Editar miden al menos 44 px de alto', async () => {
    montar()
    await esperarCarga()
    expect(screen.getByRole('switch', { name: 'Desactivar Corte clásico' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Editar Corte clásico' })).toHaveClass('min-h-11', 'min-w-11')
  })

  it('escritorio: tabla con columnas, estado en texto y filas inactivas atenuadas', async () => {
    fijarEscritorio(true)
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))

    const tabla = screen.getByRole('table', { name: 'Servicios del catálogo' })
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Servicio', 'Categoría', 'Área', 'Tipo', 'Duración', 'Precio', 'Estado', 'Acciones',
    ]) // MODIFICADO (fase 7): + columna Área
    const fila = within(tabla).getByRole('row', { name: /Corte militar/ })
    expect(fila).toHaveClass('opacity-60')
    expect(within(fila).getAllByText('Inactivo').length).toBeGreaterThan(0)
    expect(within(tabla).getByRole('row', { name: /Corte de Cabello/ })).toHaveTextContent('Otros')
  })

  it('escritorio: editar abre el formulario en un panel lateral (no a pantalla completa)', async () => {
    fijarEscritorio(true)
    montar()
    await esperarCarga()

    await userEvent.click(screen.getByRole('button', { name: 'Editar Corte clásico' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    const panel = screen.getByRole('complementary', { name: 'Editar servicio' })
    expect(within(panel).getByLabelText('Nombre')).toHaveValue('Corte clásico')
    // la tabla sigue visible a su lado
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('móvil: editar abre un diálogo a pantalla completa con foco dentro, y Escape lo cierra', async () => {
    montar()
    await esperarCarga()

    await userEvent.click(screen.getByRole('button', { name: 'Editar Corte clásico' }))

    const dialogo = screen.getByRole('dialog', { name: 'Editar servicio' })
    expect(dialogo).toHaveClass('fixed', 'inset-0')
    expect(dialogo).toContainElement(document.activeElement)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Servicios: activar y desactivar', () => {
  it('desactivar pide confirmación; "Cancelar" no cambia nada', async () => {
    montar()
    await esperarCarga()

    await userEvent.click(screen.getByRole('switch', { name: 'Desactivar Corte clásico' }))
    const dialogo = screen.getByRole('dialog', { name: /¿Desactivar «Corte clásico»\?/ })
    expect(dialogo).toHaveTextContent('conservan su precio y duración')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.actualizarServicioAdmin).not.toHaveBeenCalled()
  })

  it('confirmar desactiva con PATCH {activo:false}, avisa y recarga la lista', async () => {
    montar()
    await esperarCarga()
    const cargasAntes = vi.mocked(api.obtenerServiciosAdmin).mock.calls.length

    await userEvent.click(screen.getByRole('switch', { name: 'Desactivar Corte clásico' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

    expect(api.actualizarServicioAdmin).toHaveBeenCalledWith('tok', 10, { activo: false })
    expect(await screen.findByRole('status')).toHaveTextContent('«Corte clásico» desactivado')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(vi.mocked(api.obtenerServiciosAdmin).mock.calls.length).toBe(cargasAntes + 1))
  })

  it('si falla al desactivar, el error se muestra en el mismo diálogo', async () => {
    vi.mocked(api.actualizarServicioAdmin).mockRejectedValue(fallo('SERVICIO_NO_ENCONTRADO'))
    montar()
    await esperarCarga()

    await userEvent.click(screen.getByRole('switch', { name: 'Desactivar Corte clásico' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('ya no existe')
  })

  it('activar va directo (sin confirmación) con PATCH {activo:true}', async () => {
    montar()
    await esperarCarga()

    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Activar Corte militar' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.actualizarServicioAdmin).toHaveBeenCalledWith('tok', 11, { activo: true })
    expect(await screen.findByRole('status')).toHaveTextContent('«Corte militar» activado')
  })

  it('activar un servicio del catálogo anterior incompleto abre el formulario con el motivo (SERVICIO_INCOMPLETO)', async () => {
    vi.mocked(api.actualizarServicioAdmin).mockRejectedValue(fallo('SERVICIO_INCOMPLETO', 'x', { campo: 'tipo' }))
    montar()
    await esperarCarga()
    await userEvent.click(within(screen.getByRole('group', { name: 'Categoría' })).getByRole('button', { name: 'Otros' }))

    await userEvent.click(screen.getByRole('switch', { name: 'Activar Corte de Cabello' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Editar servicio' })
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('completa su categoría, tipo y descripción')
    expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('Corte de Cabello')
  })
})

describe('Servicios: formulario de edición', () => {
  const abrirEdicion = async (nombre = 'Corte clásico') => {
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: `Editar ${nombre}` }))
    return screen.getByRole('dialog', { name: 'Editar servicio' })
  }

  it('viene con los datos actuales', async () => {
    const dialogo = await abrirEdicion()

    expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('Corte clásico')
    expect(within(dialogo).getByLabelText('Categoría')).toHaveValue('1')
    expect(within(dialogo).getByLabelText('Tipo')).toHaveValue('original')
    expect(within(dialogo).getByLabelText('Precio (COP)')).toHaveValue('18000')
    expect(within(dialogo).getByLabelText('Duración (minutos)')).toHaveValue('30')
    expect(within(dialogo).getByLabelText('Descripción')).toHaveValue('Descripción de Corte clásico')
  })

  it.each([
    ['Nombre', '', 'El nombre es obligatorio'],
    ['Precio (COP)', '12.5', 'entero de 0 en adelante'],
    ['Precio (COP)', '-1', 'entero de 0 en adelante'],
    ['Precio (COP)', 'abc', 'entero de 0 en adelante'],
    ['Precio (COP)', '', 'entero de 0 en adelante'],
    ['Duración (minutos)', '0', 'entre 1 y 600'],
    ['Duración (minutos)', '601', 'entre 1 y 600'],
    ['Duración (minutos)', '2.5', 'entre 1 y 600'],
    ['Descripción', '   ', 'La descripción es obligatoria'],
  ])('%s = "%s" muestra el error y no llama a la API', async (etiqueta, valor, mensaje) => {
    const dialogo = await abrirEdicion()
    const campo = within(dialogo).getByLabelText(etiqueta)
    await userEvent.clear(campo)
    if (valor) await userEvent.type(campo, valor)

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(dialogo).findByText(new RegExp(mensaje))).toBeInTheDocument()
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveFocus()
    expect(api.actualizarServicioAdmin).not.toHaveBeenCalled()
  })

  it('el precio 0 es válido (gratis)', async () => {
    const dialogo = await abrirEdicion()
    const precio = within(dialogo).getByLabelText('Precio (COP)')
    await userEvent.clear(precio)
    await userEvent.type(precio, '0')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(api.actualizarServicioAdmin).toHaveBeenCalledWith('tok', 10, { precio: 0 })
  })

  it('guarda solo lo que cambió, cierra el panel, avisa y recarga las listas', async () => {
    const dialogo = await abrirEdicion()
    const cargasAntes = vi.mocked(api.obtenerServiciosAdmin).mock.calls.length
    const nombre = within(dialogo).getByLabelText('Nombre')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Corte clásico plus')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo'), 'elite')

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(api.actualizarServicioAdmin).toHaveBeenCalledWith('tok', 10, { nombre: 'Corte clásico plus', tipo: 'elite' })
    expect(await screen.findByRole('status')).toHaveTextContent('«Corte clásico plus» actualizado. Ya se ve en /cortes y en la reserva.')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(vi.mocked(api.obtenerServiciosAdmin).mock.calls.length).toBe(cargasAntes + 1))
  })

  it('sin cambios no llama a la API', async () => {
    const dialogo = await abrirEdicion()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(api.actualizarServicioAdmin).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('No había cambios')
  })

  it('NOMBRE_DUPLICADO se muestra en el campo nombre y el panel sigue abierto', async () => {
    vi.mocked(api.actualizarServicioAdmin).mockRejectedValue(fallo('NOMBRE_DUPLICADO', 'Ya existe', { campo: 'nombre' }))
    const dialogo = await abrirEdicion()
    const nombre = within(dialogo).getByLabelText('Nombre')
    await userEvent.type(nombre, ' 2')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(dialogo).findByText(/Ya existe un servicio con ese nombre \(sin distinguir mayúsculas\)/)).toBeInTheDocument()
    expect(nombre).toHaveAttribute('aria-invalid', 'true')
    expect(nombre).toHaveFocus()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled() // se puede corregir y reintentar
  })

  it('CATEGORIA_NO_DISPONIBLE se muestra en el campo categoría', async () => {
    vi.mocked(api.actualizarServicioAdmin).mockRejectedValue(fallo('CATEGORIA_NO_DISPONIBLE', 'x', { campo: 'categoria_id' }))
    const dialogo = await abrirEdicion()
    await userEvent.selectOptions(within(dialogo).getByLabelText('Categoría'), '2')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(dialogo).findByText('La categoría no existe o está inactiva. Elige otra.')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Categoría')).toHaveAttribute('aria-invalid', 'true')
  })

  it('DATOS_INVALIDOS del back-end con campo se muestra en ese campo; un error sin campo, arriba', async () => {
    vi.mocked(api.actualizarServicioAdmin)
      .mockRejectedValueOnce(fallo('DATOS_INVALIDOS', 'El precio debe ser un número entero mayor o igual a 0', { campo: 'precio' }))
      .mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    const dialogo = await abrirEdicion()
    await userEvent.type(within(dialogo).getByLabelText('Precio (COP)'), '0')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(dialogo).findByText(/El precio debe ser un número entero/)).toBeInTheDocument()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))
    expect(await within(dialogo).findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
  })

  it('las categorías inactivas no se ofrecen para elegir', async () => {
    const dialogo = await abrirEdicion()
    const opciones = within(within(dialogo).getByLabelText('Categoría')).getAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual(['Selecciona una categoría', 'Cortes', 'Barba'])
  })
})

describe('Servicios: crear', () => {
  const abrirNuevo = async () => {
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo servicio' }))
    return screen.getByRole('dialog', { name: 'Nuevo servicio' })
  }

  it('el formulario nuevo empieza vacío y valida todos los campos obligatorios', async () => {
    const dialogo = await abrirNuevo()
    expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('')

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear servicio' }))

    for (const texto of [/nombre es obligatorio/, /Elige una categoría/, /Elige el tipo/, /precio debe ser/, /duración debe ser/, /descripción es obligatoria/]) {
      expect(await within(dialogo).findByText(texto)).toBeInTheDocument()
    }
    expect(api.crearServicioAdmin).not.toHaveBeenCalled()
  })

  it('crea con los tipos ya convertidos (números), muestra el aviso y recarga', async () => {
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), '  Corte nuevo  ')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Categoría'), '1')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo'), 'vip')
    await userEvent.type(within(dialogo).getByLabelText('Precio (COP)'), '35000')
    await userEvent.type(within(dialogo).getByLabelText('Duración (minutos)'), '45')
    await userEvent.type(within(dialogo).getByLabelText('Descripción'), 'Descripción nueva')
    const cargasAntes = vi.mocked(api.obtenerServiciosAdmin).mock.calls.length

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear servicio' }))

    expect(api.crearServicioAdmin).toHaveBeenCalledWith('tok', {
      nombre: 'Corte nuevo', area: 'barberia', categoria_id: 1, tipo: 'vip', precio: 35000, duracion_min: 45, descripcion: 'Descripción nueva',
    }) // MODIFICADO (fase 7): + area (barbería por defecto)
    expect(await screen.findByRole('status')).toHaveTextContent('«Corte nuevo» creado')
    await waitFor(() => expect(vi.mocked(api.obtenerServiciosAdmin).mock.calls.length).toBe(cargasAntes + 1))
  })

  it('escritorio: "Nuevo servicio" abre el panel lateral', async () => {
    fijarEscritorio(true)
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo servicio' }))

    expect(screen.getByRole('complementary', { name: 'Nuevo servicio' })).toBeInTheDocument()
  })

  it('el contador de la descripción cuenta hasta 500', async () => {
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Descripción'), 'hola')
    expect(within(dialogo).getByText('4/500')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Descripción')).toHaveAttribute('maxlength', '500')
  })
})

describe('Servicios: estados de la pantalla', () => {
  it('cargando', async () => {
    vi.mocked(api.obtenerServiciosAdmin).mockReturnValue(new Promise(() => {}))
    montar()
    expect(await screen.findByText('Cargando servicios...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo servicio' })).toBeDisabled()
  })

  it('error con "Reintentar" que vuelve a pedir ambas listas', async () => {
    vi.mocked(api.obtenerServiciosAdmin).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    montar()

    const alerta = (await screen.findByText('No pudimos cargar el catálogo.')).closest('[role="alert"]')
    await userEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))

    expect(await esperarCarga()).toBeInTheDocument()
    expect(api.obtenerServiciosAdmin).toHaveBeenCalledTimes(2)
  })

  it('catálogo vacío', async () => {
    vi.mocked(api.obtenerServiciosAdmin).mockResolvedValue([])
    montar()
    expect(await screen.findByText(/Todavía no hay servicios/)).toBeInTheDocument()
  })
})

describe('Servicios: sección de categorías', () => {
  const abrirSeccion = async () => {
    montar()
    await esperarCarga()
    const boton = screen.getByRole('button', { name: /Categorías/ })
    await userEvent.click(boton)
    return screen.getByRole('button', { name: /Categorías/ }).closest('section')
  }

  it('está plegada por defecto y se abre con el botón (aria-expanded)', async () => {
    montar()
    await esperarCarga()
    const boton = screen.getByRole('button', { name: /Categorías/ })

    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Nueva categoría')).toBeNull()
    await userEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Nueva categoría')).toBeInTheDocument()
  })

  it('lista las categorías con su identificador, orden y estado', async () => {
    const seccion = await abrirSeccion()

    expect(within(seccion).getByText(/Identificador: cortes · Orden 1 · 2 activo\(s\), 0 inactivo\(s\)/)).toBeInTheDocument()
    expect(within(seccion).getByRole('switch', { name: 'Activar la categoría Vacía' })).toHaveAttribute('aria-checked', 'false')
    expect(within(seccion).getByText('Inactiva')).toBeInTheDocument()
  })

  it('crea una categoría (orden opcional) y recarga', async () => {
    vi.mocked(api.crearCategoriaAdmin).mockResolvedValue({})
    const seccion = await abrirSeccion()

    await userEvent.type(within(seccion).getByLabelText('Nueva categoría'), '  Tintes  ')
    await userEvent.click(within(seccion).getByRole('button', { name: 'Crear categoría' }))

    expect(api.crearCategoriaAdmin).toHaveBeenCalledWith('tok', { nombre: 'Tintes' })
    expect(await within(seccion).findByRole('status')).toHaveTextContent('Categoría «Tintes» creada.')
    expect(within(seccion).getByLabelText('Nueva categoría')).toHaveValue('')

    await userEvent.type(within(seccion).getByLabelText('Nueva categoría'), 'Spa')
    await userEvent.type(within(seccion).getByLabelText('Orden (opcional)'), '7')
    await userEvent.click(within(seccion).getByRole('button', { name: 'Crear categoría' }))
    expect(api.crearCategoriaAdmin).toHaveBeenLastCalledWith('tok', { nombre: 'Spa', orden: 7 })
  })

  it('valida nombre y orden antes de enviar y muestra NOMBRE_DUPLICADO en el campo', async () => {
    vi.mocked(api.crearCategoriaAdmin).mockRejectedValue(fallo('NOMBRE_DUPLICADO', 'x', { campo: 'nombre' }))
    const seccion = await abrirSeccion()

    await userEvent.click(within(seccion).getByRole('button', { name: 'Crear categoría' }))
    expect(await within(seccion).findByText(/El nombre es obligatorio/)).toBeInTheDocument()

    await userEvent.type(within(seccion).getByLabelText('Nueva categoría'), 'Cortes')
    await userEvent.type(within(seccion).getByLabelText('Orden (opcional)'), 'x')
    await userEvent.click(within(seccion).getByRole('button', { name: 'Crear categoría' }))
    expect(await within(seccion).findByText(/El orden debe ser un número entero/)).toBeInTheDocument()
    expect(api.crearCategoriaAdmin).not.toHaveBeenCalled()

    await userEvent.clear(within(seccion).getByLabelText('Orden (opcional)'))
    await userEvent.click(within(seccion).getByRole('button', { name: 'Crear categoría' }))
    expect(await within(seccion).findByText(/Ya existe una categoría con ese nombre/)).toBeInTheDocument()
  })

  it('renombra y reordena (sin poder editar el identificador)', async () => {
    vi.mocked(api.actualizarCategoriaAdmin).mockResolvedValue({})
    const seccion = await abrirSeccion()

    await userEvent.click(within(seccion).getByRole('button', { name: 'Editar la categoría Cortes' }))
    const nombre = within(seccion).getByLabelText('Nombre')
    expect(within(seccion).queryByLabelText(/identificador|slug/i)).toBeNull()
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Cortes de pelo')
    const orden = within(seccion).getByLabelText('Orden')
    await userEvent.clear(orden)
    await userEvent.type(orden, '5')
    await userEvent.click(within(seccion).getByRole('button', { name: 'Guardar' }))

    expect(api.actualizarCategoriaAdmin).toHaveBeenCalledWith('tok', 1, { nombre: 'Cortes de pelo', orden: 5 })
    expect(await within(seccion).findByRole('status')).toHaveTextContent('Categoría «Cortes de pelo» actualizada.')
  })

  it('activar va directo; desactivar pide confirmación', async () => {
    vi.mocked(api.actualizarCategoriaAdmin).mockResolvedValue({})
    const seccion = await abrirSeccion()

    await userEvent.click(within(seccion).getByRole('switch', { name: 'Activar la categoría Vacía' }))
    expect(api.actualizarCategoriaAdmin).toHaveBeenCalledWith('tok', 3, { activo: true })

    await userEvent.click(within(seccion).getByRole('switch', { name: 'Desactivar la categoría Barba' }))
    const dialogo = screen.getByRole('dialog', { name: /¿Desactivar la categoría «Barba»\?/ })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }))
    expect(api.actualizarCategoriaAdmin).toHaveBeenLastCalledWith('tok', 2, { activo: false })
  })

  it('CATEGORIA_CON_SERVICIOS se explica en el diálogo, con cuántos servicios activos tiene, y no cambia nada', async () => {
    vi.mocked(api.actualizarCategoriaAdmin).mockRejectedValue(fallo('CATEGORIA_CON_SERVICIOS', 'x', { total_servicios: 3 }))
    const seccion = await abrirSeccion()

    await userEvent.click(within(seccion).getByRole('switch', { name: 'Desactivar la categoría Cortes' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

    const alerta = await within(screen.getByRole('dialog')).findByRole('alert')
    expect(alerta).toHaveTextContent('tiene 3 servicio(s) activo(s)')
    expect(alerta).toHaveTextContent('Desactívalos o muévelos')
  })
})
