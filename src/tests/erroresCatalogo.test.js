import { describe, it, expect } from 'vitest'
import { interpretarError, validarFormularioServicio } from '../utils/erroresCatalogo'

const error = (codigo, extra = {}) => Object.assign(new Error('texto del servidor'), { codigo, ...extra })

describe('interpretarError (por código, no por texto)', () => {
  it('NOMBRE_DUPLICADO: servicio o categoría, en el campo nombre', () => {
    expect(interpretarError(error('NOMBRE_DUPLICADO'), 'servicio')).toEqual({
      campo: 'nombre',
      mensaje: 'Ya existe un servicio con ese nombre (sin distinguir mayúsculas). Usa otro.',
    })
    expect(interpretarError(error('NOMBRE_DUPLICADO'), 'categoría').mensaje).toMatch(/una categoría/)
  })

  it('CATEGORIA_NO_DISPONIBLE y SERVICIO_INCOMPLETO apuntan a su campo', () => {
    expect(interpretarError(error('CATEGORIA_NO_DISPONIBLE')).campo).toBe('categoria_id')
    expect(interpretarError(error('SERVICIO_INCOMPLETO', { campo: 'tipo' })).campo).toBe('tipo')
  })

  it('CATEGORIA_CON_SERVICIOS dice cuántos servicios activos tiene', () => {
    const { campo, mensaje } = interpretarError(error('CATEGORIA_CON_SERVICIOS', { total_servicios: 4 }), 'categoría')
    expect(campo).toBeNull()
    expect(mensaje).toContain('tiene 4 servicio(s) activo(s)')
  })

  it('DATOS_INVALIDOS conserva el texto y el campo del servidor; lo desconocido usa el texto del error', () => {
    expect(interpretarError(error('DATOS_INVALIDOS', { campo: 'precio' }))).toEqual({ campo: 'precio', mensaje: 'texto del servidor' })
    expect(interpretarError(new Error('No se pudo conectar con el servidor'))).toEqual({
      campo: null,
      mensaje: 'No se pudo conectar con el servidor',
    })
  })

  it('no encontrado pide recargar', () => {
    expect(interpretarError(error('SERVICIO_NO_ENCONTRADO'), 'servicio').mensaje).toMatch(/Recarga la página/)
    expect(interpretarError(error('CATEGORIA_NO_ENCONTRADA'), 'categoría').mensaje).toMatch(/categoría ya no existe/)
  })
})

describe('validarFormularioServicio', () => {
  const validos = { nombre: '  Corte  ', categoria_id: '3', tipo: 'elite', precio: '25000', duracion_min: '40', descripcion: ' Desc ' }

  it('convierte tipos, recorta textos y no devuelve errores', () => {
    expect(validarFormularioServicio(validos)).toEqual({
      errores: {},
      // MODIFICADO (fase 7): + area (barbería por defecto)
      datos: { nombre: 'Corte', area: 'barberia', categoria_id: 3, tipo: 'elite', precio: 25000, duracion_min: 40, descripcion: 'Desc' },
    })
  })

  it('acepta los límites: precio 0, duración 1 y 600, nombre de 150 y descripción de 500', () => {
    const { datos } = validarFormularioServicio({ ...validos, precio: '0', duracion_min: '1', nombre: 'n'.repeat(150), descripcion: 'd'.repeat(500) })
    expect(datos).toMatchObject({ precio: 0, duracion_min: 1 })
    expect(validarFormularioServicio({ ...validos, duracion_min: '600' }).datos.duracion_min).toBe(600)
  })

  it.each([
    ['nombre', ''], ['nombre', 'n'.repeat(151)], ['categoria_id', ''], ['tipo', ''],
    ['precio', '-1'], ['precio', '1.5'], ['precio', '1e3'], ['precio', ' '], ['precio', '2147483648'],
    ['duracion_min', '0'], ['duracion_min', '601'], ['duracion_min', '3.2'], ['duracion_min', ''],
    ['descripcion', ''], ['descripcion', 'd'.repeat(501)],
  ])('rechaza %s = "%s"', (campo, valor) => {
    const { errores, datos } = validarFormularioServicio({ ...validos, [campo]: valor })
    expect(datos).toBeNull()
    expect(errores[campo]).toBeTruthy()
  })

  it('reporta todos los errores a la vez', () => {
    const { errores } = validarFormularioServicio({ nombre: '', categoria_id: '', tipo: '', precio: '', duracion_min: '', descripcion: '' })
    expect(Object.keys(errores).sort()).toEqual(['categoria_id', 'descripcion', 'duracion_min', 'nombre', 'precio', 'tipo'])
  })
})
