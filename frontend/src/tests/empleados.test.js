import { describe, it, expect } from 'vitest'
import {
  iniciales,
  ordenarEmpleados,
  filtrarEmpleados,
  textoCitasPendientes,
  validarFormularioEmpleado,
  validarFormularioAcceso,
  interpretarErrorEmpleado,
  enlaceCitasPendientes,
} from '../utils/empleados'

const error = (codigo, extra = {}) => Object.assign(new Error('texto del servidor'), { codigo, ...extra })

describe('iniciales', () => {
  it.each([
    ['Ángel Mejía', 'ÁM'],
    ['boby', 'B'],
    ['  ana   maría  de la cruz ', 'AC'],
    ['élan', 'É'],
    ['', '?'],
    ['   ', '?'],
  ])('%j → %s', (nombre, esperado) => {
    expect(iniciales(nombre)).toBe(esperado)
  })
})

describe('ordenarEmpleados', () => {
  it('ordena alfabéticamente en español: "Ángel" va antes que "Boby" (y "Ñandú" después de "Nora")', () => {
    const nombres = ['Zoe', 'Boby', 'Ñandú', 'Ángel', 'Nora', 'Eva'].map((nombre, i) => ({ id: i + 1, nombre }))
    expect(ordenarEmpleados(nombres).map((e) => e.nombre)).toEqual(['Ángel', 'Boby', 'Eva', 'Nora', 'Ñandú', 'Zoe'])
  })

  it('no ordena igual que una comparación por código (que mandaría "Ángel" al final)', () => {
    const nombres = [{ id: 1, nombre: 'Boby' }, { id: 2, nombre: 'Ángel' }]
    expect([...nombres].sort((a, b) => (a.nombre < b.nombre ? -1 : 1))[0].nombre).toBe('Boby')
    expect(ordenarEmpleados(nombres)[0].nombre).toBe('Ángel')
  })

  it('a igualdad de nombre desempata por id y no modifica la lista original', () => {
    const original = [{ id: 9, nombre: 'Leo' }, { id: 2, nombre: 'Leo' }]
    expect(ordenarEmpleados(original).map((e) => e.id)).toEqual([2, 9])
    expect(original.map((e) => e.id)).toEqual([9, 2])
  })
})

describe('filtrarEmpleados', () => {
  const lista = [
    { id: 1, nombre: 'Ángel', cargo: 'Barbero Senior', especialidad: 'Fade', activo: true, usuario: { usuario: 'angel01' } },
    { id: 2, nombre: 'Boby', cargo: null, especialidad: null, activo: false, usuario: null },
  ]

  it('por estado: activos (por defecto), inactivos y todos', () => {
    expect(filtrarEmpleados(lista).map((e) => e.id)).toEqual([1])
    expect(filtrarEmpleados(lista, { estado: 'inactivos' }).map((e) => e.id)).toEqual([2])
    expect(filtrarEmpleados(lista, { estado: 'todos' }).map((e) => e.id)).toEqual([1, 2])
  })

  it('busca sin distinguir mayúsculas ni tildes, en nombre, cargo, especialidad y usuario', () => {
    expect(filtrarEmpleados(lista, { estado: 'todos', busqueda: 'angel' }).map((e) => e.id)).toEqual([1])
    expect(filtrarEmpleados(lista, { estado: 'todos', busqueda: 'ÁNGEL' }).map((e) => e.id)).toEqual([1])
    expect(filtrarEmpleados(lista, { estado: 'todos', busqueda: 'senior' }).map((e) => e.id)).toEqual([1])
    expect(filtrarEmpleados(lista, { estado: 'todos', busqueda: 'FADE' }).map((e) => e.id)).toEqual([1])
    expect(filtrarEmpleados(lista, { estado: 'todos', busqueda: 'angel01' }).map((e) => e.id)).toEqual([1])
    expect(filtrarEmpleados(lista, { estado: 'todos', busqueda: 'nadie' })).toEqual([])
  })
})

describe('textoCitasPendientes y enlaceCitasPendientes', () => {
  it('singular y plural', () => {
    expect(textoCitasPendientes(1)).toBe('1 cita pendiente')
    expect(textoCitasPendientes(3)).toBe('3 citas pendientes')
  })

  it('el enlace lleva a las citas próximas de ese barbero', () => {
    expect(enlaceCitasPendientes({ id: 7 })).toBe('/admin/citas?barbero=7&pestana=proximas')
  })
})

describe('validarFormularioEmpleado', () => {
  const validos = { nombre: '  Ángel  ', cargo: ' Senior ', especialidad: '', usuario: ' angel ', contrasena: '12345678' }

  it('recorta textos y devuelve usuario y contraseña solo en el alta', () => {
    expect(validarFormularioEmpleado(validos, { conAcceso: true })).toEqual({
      errores: {},
      // MODIFICADO (fase 7): los datos llevan el área (barbería por defecto)
      datos: { nombre: 'Ángel', cargo: 'Senior', especialidad: '', area: 'barberia', usuario: 'angel', contrasena: '12345678' },
    })
    expect(validarFormularioEmpleado(validos, { conAcceso: false }).datos).toEqual({ nombre: 'Ángel', cargo: 'Senior', especialidad: '', area: 'barberia' }) // MODIFICADO (fase 7): + area
  })

  it('acepta los límites: nombre 100, cargo 100, especialidad 150, usuario 50, contraseña 8 y 72', () => {
    const limite = { nombre: 'n'.repeat(100), cargo: 'c'.repeat(100), especialidad: 'e'.repeat(150), usuario: 'u'.repeat(50), contrasena: 'x'.repeat(72) }
    expect(validarFormularioEmpleado(limite, { conAcceso: true }).errores).toEqual({})
  })

  it.each([
    ['nombre', ''], ['nombre', '   '], ['nombre', 'n'.repeat(101)],
    ['cargo', 'c'.repeat(101)], ['especialidad', 'e'.repeat(151)],
    ['usuario', ''], ['usuario', '  '], ['usuario', 'u'.repeat(51)],
    ['contrasena', '1234567'], ['contrasena', 'x'.repeat(73)], ['contrasena', ''],
  ])('rechaza %s = "%s"', (campo, valor) => {
    const { errores, datos } = validarFormularioEmpleado({ ...validos, [campo]: valor }, { conAcceso: true })
    expect(datos).toBeNull()
    expect(errores[campo]).toBeTruthy()
  })

  it('al editar no exige usuario ni contraseña', () => {
    const { errores, datos } = validarFormularioEmpleado({ ...validos, usuario: '', contrasena: '' }, { conAcceso: false })
    expect(errores).toEqual({})
    expect(datos).not.toBeNull()
  })
})

describe('validarFormularioAcceso', () => {
  it('restablecer pide solo contraseña; crear acceso pide también usuario', () => {
    expect(validarFormularioAcceso({ usuario: '', contrasena: '12345678' }, { creando: false }).datos).not.toBeNull()
    expect(validarFormularioAcceso({ usuario: '', contrasena: '12345678' }, { creando: true }).errores.usuario).toBeTruthy()
    expect(validarFormularioAcceso({ usuario: 'x', contrasena: '1234' }, { creando: false }).errores.contrasena).toBeTruthy()
  })
})

describe('interpretarErrorEmpleado (por código, no por texto)', () => {
  it('USUARIO_DUPLICADO apunta al campo usuario', () => {
    expect(interpretarErrorEmpleado(error('USUARIO_DUPLICADO'))).toEqual({ campo: 'usuario', mensaje: 'Ese nombre de usuario ya existe. Elige otro.' })
  })

  it('DATOS_INVALIDOS conserva el texto y el campo del servidor; lo desconocido usa el texto del error', () => {
    expect(interpretarErrorEmpleado(error('DATOS_INVALIDOS', { campo: 'cargo' }))).toEqual({ campo: 'cargo', mensaje: 'texto del servidor' })
    expect(interpretarErrorEmpleado(new Error('No se pudo conectar con el servidor'))).toEqual({ campo: null, mensaje: 'No se pudo conectar con el servidor' })
  })

  it('no encontrado pide recargar y BARBERO_INACTIVO pide activar', () => {
    expect(interpretarErrorEmpleado(error('EMPLEADO_NO_ENCONTRADO')).mensaje).toMatch(/Recarga la página/)
    expect(interpretarErrorEmpleado(error('BARBERO_INACTIVO')).mensaje).toMatch(/Actívalo/)
  })
})
