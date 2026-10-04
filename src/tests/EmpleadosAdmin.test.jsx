import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Empleados from '../pages/admin/Empleados'
import * as api from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'tok', usuario: { usuario: 'admin', rol: 'admin' } }),
}))

const empleado = (id, nombre, extra = {}) => ({
  id,
  nombre,
  cargo: 'Barbero Profesional',
  especialidad: 'Fade',
  foto: null,
  activo: true,
  usuario: { id: id * 10, usuario: nombre.toLowerCase().replace(/\s/g, ''), activo: true },
  usuarios_total: 1,
  cortes_mes: 0,
  citas_pendientes: 0,
  ...extra,
})

// El back-end no ordena para el front: se entrega desordenado a propósito.
const EMPLEADOS = [
  empleado(3, 'Boby', { cortes_mes: 12, citas_pendientes: 3, foto: '/Barberos/boby.jpg' }),
  empleado(9, 'Zoe', { activo: false, usuario: { id: 90, usuario: 'zoe', activo: false } }),
  empleado(4, 'Ángel', { citas_pendientes: 0 }),
  empleado(6, 'Sin Acceso', { usuario: null, usuarios_total: 0 }),
  empleado(7, 'Dos Usuarios', { usuarios_total: 3 }),
]

const fallo = (codigo, mensaje = 'error', extra = {}) => Object.assign(new Error(mensaje), { codigo, ...extra })

const fijarEscritorio = (esEscritorio) => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: esEscritorio, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

const montar = () => render(<MemoryRouter><Empleados /></MemoryRouter>)
const esperarCarga = () => screen.findByRole('group', { name: 'Estado' })
const tarjeta = (nombre) => screen.getByRole('heading', { name: new RegExp(`^${nombre}`) }).closest('article')
const nombresVisibles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent.replace('Inactivo', ''))

beforeEach(() => {
  fijarEscritorio(false)
  vi.mocked(api.obtenerEmpleados).mockResolvedValue(EMPLEADOS)
  vi.mocked(api.actualizarEmpleado).mockImplementation(async (_t, id, cambios) => ({
    ...EMPLEADOS.find((e) => e.id === id), ...cambios, ...(cambios.activo === false ? { citas_pendientes_conservadas: EMPLEADOS.find((e) => e.id === id).citas_pendientes } : {}),
  }))
  vi.mocked(api.crearEmpleado).mockImplementation(async (_t, datos) => ({ id: 99, ...datos, activo: true }))
  vi.mocked(api.actualizarUsuarioBarbero).mockResolvedValue({})
  vi.mocked(api.crearUsuarioBarbero).mockResolvedValue({})
})

afterEach(() => {
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('Empleados: carga, orden y filtros', () => {
  it('pide los empleados con el token y los ordena con tildes en el front: "Ángel" antes de "Boby"', async () => {
    montar()
    await esperarCarga()

    expect(api.obtenerEmpleados).toHaveBeenCalledWith('tok')
    expect(screen.getByRole('heading', { level: 1, name: 'Empleados' })).toBeInTheDocument()
    expect(nombresVisibles()).toEqual(['Ángel', 'Boby', 'Dos Usuarios', 'Sin Acceso'])
  })

  it('muestra solo los activos por defecto, con el total de cada estado, y permite ver inactivos o todos', async () => {
    montar()
    await esperarCarga()
    const estados = within(screen.getByRole('group', { name: 'Estado' }))

    expect(estados.getByRole('button', { name: /Activos/ })).toHaveAttribute('aria-pressed', 'true')
    expect(estados.getByRole('button', { name: /Activos/ })).toHaveTextContent('(4)')
    expect(estados.getByRole('button', { name: /Inactivos/ })).toHaveTextContent('(1)')
    expect(screen.queryByRole('heading', { name: /Zoe/ })).toBeNull()

    await userEvent.click(estados.getByRole('button', { name: /Inactivos/ }))
    expect(nombresVisibles()).toEqual(['Zoe'])
    expect(within(tarjeta('Zoe')).getAllByText('Inactivo')).toHaveLength(2) // etiqueta + texto del interruptor
    expect(tarjeta('Zoe')).toHaveClass('opacity-60')

    await userEvent.click(estados.getByRole('button', { name: /Todos/ }))
    expect(nombresVisibles()).toEqual(['Ángel', 'Boby', 'Dos Usuarios', 'Sin Acceso', 'Zoe'])
  })

  it('el buscador filtra sin importar mayúsculas ni tildes y "Limpiar filtros" lo deshace', async () => {
    montar()
    await esperarCarga()

    await userEvent.type(screen.getByLabelText('Buscar'), 'angel')
    expect(nombresVisibles()).toEqual(['Ángel'])

    await userEvent.clear(screen.getByLabelText('Buscar'))
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzz')
    expect(screen.getByText('No hay empleados con esos filtros.')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]) // el de los filtros y el del aviso vacío hacen lo mismo
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
    expect(nombresVisibles()).toHaveLength(4)
  })

  it('cada empleado muestra sus cortes del mes, citas pendientes y usuario (indicando si hay más de uno o ninguno)', async () => {
    montar()
    await esperarCarga()

    const boby = tarjeta('Boby')
    expect(within(boby).getByText('Cortes este mes').nextSibling).toHaveTextContent('12')
    expect(within(boby).getByRole('link', { name: /3 citas pendientes de Boby/ })).toHaveAttribute('href', '/admin/citas?barbero=3&pestana=proximas')
    expect(within(boby).getByText('Usuario: boby')).toBeInTheDocument()
    expect(within(tarjeta('Dos Usuarios')).getByText('Usuario: dosusuarios (+2 más)')).toBeInTheDocument()
    expect(within(tarjeta('Sin Acceso')).getByText('Sin acceso al panel')).toBeInTheDocument()
    expect(within(tarjeta('Ángel')).queryByRole('link')).toBeNull() // sin pendientes no hay enlace
  })

  it('con foto la muestra; sin foto el avatar lleva sus iniciales', async () => {
    montar()
    await esperarCarga()
    expect(within(tarjeta('Boby')).getByAltText(/foto de boby/i)).toBeInTheDocument()
    expect(within(tarjeta('Ángel')).getByRole('img', { name: 'Avatar de Ángel' })).toHaveTextContent('Á')
    expect(within(tarjeta('Sin Acceso')).getByRole('img', { name: 'Avatar de Sin Acceso' })).toHaveTextContent('SA')
  })
})

describe('Empleados: estados de carga, vacío y error', () => {
  it('muestra "Cargando" y luego la lista', async () => {
    montar()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando empleados')
    await esperarCarga()
  })

  it('si falla la carga muestra el error con "Reintentar", que vuelve a pedir los datos', async () => {
    vi.mocked(api.obtenerEmpleados).mockRejectedValueOnce(new Error('sin conexión'))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los empleados')
    expect(screen.getByRole('button', { name: 'Nuevo empleado' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await esperarCarga()
    expect(api.obtenerEmpleados).toHaveBeenCalledTimes(2)
  })

  it('sin empleados invita a crear el primero', async () => {
    vi.mocked(api.obtenerEmpleados).mockResolvedValue([])
    montar()
    expect(await screen.findByText(/Todavía no hay empleados/)).toBeInTheDocument()
  })
})

describe('Empleados: crear', () => {
  const abrirNuevo = async () => {
    montar()
    await esperarCarga()
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo empleado' }))
    return screen.getByRole('dialog', { name: 'Nuevo empleado' })
  }

  it('valida en el cliente con las reglas del back, muestra los errores en cada campo y no llama a la API', async () => {
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), '1234567')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear empleado' }))

    expect(within(dialogo).getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialogo).getByText(/El nombre es obligatorio/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/El usuario es obligatorio/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/entre 8 y 72 caracteres/, { selector: 'p[role="alert"]' })).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Nombre')).toHaveFocus()
    expect(api.crearEmpleado).not.toHaveBeenCalled()
  })

  it('envía los datos recortados, cierra el panel, avisa y recarga la lista', async () => {
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), '  Nuevo Barbero ')
    await userEvent.type(within(dialogo).getByLabelText(/Cargo/), 'Barbero Profesional')
    await userEvent.type(within(dialogo).getByLabelText('Usuario de acceso'), ' nuevo01 ')
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), 'clave-segura-1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear empleado' }))

    expect(api.crearEmpleado).toHaveBeenCalledWith('tok', {
      nombre: 'Nuevo Barbero', cargo: 'Barbero Profesional', especialidad: '', usuario: 'nuevo01', contrasena: 'clave-segura-1',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('«Nuevo Barbero» creado')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.obtenerEmpleados).toHaveBeenCalledTimes(2)
  })

  it('USUARIO_DUPLICADO se muestra en el campo usuario (por código), con foco, y el panel sigue abierto', async () => {
    vi.mocked(api.crearEmpleado).mockRejectedValue(fallo('USUARIO_DUPLICADO', 'Ese nombre de usuario ya existe'))
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Nuevo')
    await userEvent.type(within(dialogo).getByLabelText('Usuario de acceso'), 'boby')
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), 'clave-segura-1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear empleado' }))

    const campo = await within(dialogo).findByLabelText('Usuario de acceso')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialogo).getByText('Ese nombre de usuario ya existe. Elige otro.')).toBeInTheDocument()
    expect(campo).toHaveFocus()
    expect(within(dialogo).getByRole('button', { name: 'Crear empleado' })).toBeEnabled() // se puede corregir y reintentar
  })

  it('un error sin campo (p. ej. de red) se muestra arriba del formulario', async () => {
    vi.mocked(api.crearEmpleado).mockRejectedValue(new Error('No se pudo conectar con el servidor'))
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Nuevo')
    await userEvent.type(within(dialogo).getByLabelText('Usuario de acceso'), 'nuevo01')
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), 'clave-segura-1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear empleado' }))
    expect(await within(dialogo).findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
  })

  it('el botón del ojo muestra y oculta la contraseña', async () => {
    const dialogo = await abrirNuevo()
    const campo = within(dialogo).getByLabelText('Contraseña')
    expect(campo).toHaveAttribute('type', 'password')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
  })
})

describe('Empleados: editar y acceso', () => {
  it('editar envía solo los campos que cambiaron', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Boby')).getByRole('button', { name: 'Editar Boby' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar empleado' })
    expect(within(dialogo).queryByLabelText('Usuario de acceso')).toBeNull() // el usuario no se edita aquí

    await userEvent.clear(within(dialogo).getByLabelText(/Cargo/))
    await userEvent.type(within(dialogo).getByLabelText(/Cargo/), 'Barbero Senior')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(api.actualizarEmpleado).toHaveBeenCalledWith('tok', 3, { cargo: 'Barbero Senior' })
    expect(await screen.findByRole('status')).toHaveTextContent('«Boby» actualizado')
  })

  it('sin cambios no llama a la API', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Boby')).getByRole('button', { name: 'Editar Boby' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(api.actualizarEmpleado).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('No había cambios')
  })

  it('restablecer contraseña usa el usuario del empleado y valida el largo', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Boby')).getByRole('button', { name: 'Restablecer la contraseña de Boby' }))
    const dialogo = screen.getByRole('dialog', { name: 'Acceso al panel' })

    await userEvent.type(within(dialogo).getByLabelText('Contraseña nueva'), 'corta')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar contraseña' }))
    expect(within(dialogo).getByText(/entre 8 y 72 caracteres/, { selector: 'p[role="alert"]' })).toBeInTheDocument()
    expect(api.actualizarUsuarioBarbero).not.toHaveBeenCalled()

    await userEvent.clear(within(dialogo).getByLabelText('Contraseña nueva'))
    await userEvent.type(within(dialogo).getByLabelText('Contraseña nueva'), 'nueva-clave-1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar contraseña' }))
    expect(api.actualizarUsuarioBarbero).toHaveBeenCalledWith('tok', 30, { contrasena: 'nueva-clave-1' })
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña de «Boby» actualizada')
  })

  it('un barbero sin usuario ofrece "Crear acceso" con usuario y contraseña', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Sin Acceso')).getByRole('button', { name: 'Crear acceso para Sin Acceso' }))
    const dialogo = screen.getByRole('dialog', { name: 'Acceso al panel' })

    await userEvent.type(within(dialogo).getByLabelText('Usuario de acceso'), 'sinacceso')
    await userEvent.type(within(dialogo).getByLabelText('Contraseña nueva'), 'clave-segura-1')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear acceso' }))
    expect(api.crearUsuarioBarbero).toHaveBeenCalledWith('tok', { usuario: 'sinacceso', contrasena: 'clave-segura-1', barbero_id: 6 })
  })
})

describe('Empleados: activar y desactivar', () => {
  it('desactivar pide confirmación; sin citas pendientes no muestra aviso ni enlace', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Ángel')).getByRole('switch', { name: 'Desactivar a Ángel' }))

    const modal = screen.getByRole('dialog', { name: /¿Desactivar a «Ángel»\?/ })
    expect(within(modal).queryByRole('note')).toBeNull()
    expect(api.actualizarEmpleado).not.toHaveBeenCalled()

    await userEvent.click(within(modal).getByRole('button', { name: 'Desactivar' }))
    expect(api.actualizarEmpleado).toHaveBeenCalledWith('tok', 4, { activo: false })
    expect(await screen.findByRole('status')).toHaveTextContent('«Ángel» desactivado')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con citas pendientes el aviso dice cuántas y enlaza a /admin/citas para reasignarlas', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Boby')).getByRole('switch', { name: 'Desactivar a Boby' }))

    const modal = screen.getByRole('dialog', { name: /¿Desactivar a «Boby»\?/ })
    expect(within(modal).getByRole('note')).toHaveTextContent('3 citas pendientes')
    expect(within(modal).getByRole('link', { name: 'Ver y reasignar sus citas' })).toHaveAttribute(
      'href', '/admin/citas?barbero=3&pestana=proximas'
    )

    await userEvent.click(within(modal).getByRole('button', { name: 'Desactivar' }))
    const aviso = await screen.findByRole('status')
    expect(aviso).toHaveTextContent('Conserva 3 citas pendientes')
    expect(within(aviso).getByRole('link', { name: 'Ver y reasignar sus citas' })).toHaveAttribute('href', '/admin/citas?barbero=3&pestana=proximas')
  })

  it('cancelar el diálogo no cambia nada', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Ángel')).getByRole('switch', { name: 'Desactivar a Ángel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.actualizarEmpleado).not.toHaveBeenCalled()
  })

  it('un error al desactivar se muestra dentro del diálogo y se puede reintentar', async () => {
    vi.mocked(api.actualizarEmpleado).mockRejectedValueOnce(fallo('EMPLEADO_NO_ENCONTRADO'))
    montar()
    await esperarCarga()
    await userEvent.click(within(tarjeta('Ángel')).getByRole('switch', { name: 'Desactivar a Ángel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese empleado ya no existe')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('activar a un inactivo es directo (sin confirmación)', async () => {
    montar()
    await esperarCarga()
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado' })).getByRole('button', { name: /Inactivos/ }))
    await userEvent.click(within(tarjeta('Zoe')).getByRole('switch', { name: 'Activar a Zoe' }))

    expect(api.actualizarEmpleado).toHaveBeenCalledWith('tok', 9, { activo: true })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('status')).toHaveTextContent('«Zoe» activado')
  })
})

describe('Empleados: escritorio', () => {
  it('con ancho de escritorio usa una tabla con columnas, orden alfabético y panel lateral (no pantalla completa)', async () => {
    fijarEscritorio(true)
    montar()
    await esperarCarga()

    const tabla = screen.getByRole('table', { name: 'Empleados' })
    const columnas = within(tabla).getAllByRole('columnheader').map((c) => c.textContent)
    expect(columnas).toEqual(['Empleado', 'Cargo', 'Estado', 'Cortes este mes', 'Citas pendientes', 'Acciones'])
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getAllByRole('rowheader')[0].textContent)).toEqual([
      expect.stringContaining('Ángel'), expect.stringContaining('Boby'), expect.stringContaining('Dos Usuarios'), expect.stringContaining('Sin Acceso'),
    ])

    await userEvent.click(within(filas[0]).getByRole('button', { name: 'Editar Ángel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('complementary')).toHaveAccessibleName('Editar empleado')
  })
})
