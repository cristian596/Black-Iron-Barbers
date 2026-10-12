import { describe, it, expect } from 'vitest'
import { leerServiciosDeUrl, mismosIds, normalizarIds, parsearListaServicios } from '../utils/seleccionReserva'
import {
  estadoInicialReserva,
  mensajeErrorSeleccion,
  reservaReducer,
  MENSAJE_SERVICIO_NO_DISPONIBLE,
  MENSAJE_SERVICIOS_NO_DISPONIBLES,
} from '../components/sections/reserva/reservaReducer'

const leer = (consulta) => leerServiciosDeUrl(new URLSearchParams(consulta))

describe('lectura de los servicios desde la URL', () => {
  it('?servicios=1,2,3 → ids en orden y viene del carrito', () => {
    expect(leer('servicios=1,2,3')).toEqual({ ids: [1, 2, 3], desdeCarrito: true })
    expect(leer('servicios=3,1')).toEqual({ ids: [3, 1], desdeCarrito: true })
  })

  it('?servicio=<id> (camino rápido) → un solo id y NO viene del carrito', () => {
    expect(leer('servicio=4')).toEqual({ ids: [4], desdeCarrito: false })
  })

  it('sin parámetros → vacío', () => {
    expect(leer('')).toEqual({ ids: [], desdeCarrito: false })
  })

  it('ignora la basura y se queda con los enteros válidos', () => {
    expect(leer('servicios=abc,2,-4,2.5,,1e3, 7 ,0')).toEqual({ ids: [2, 7], desdeCarrito: true })
    expect(leer('servicios=%20%2C,;;,<script>')).toEqual({ ids: [], desdeCarrito: false })
  })

  it('quita repetidos (queda la primera aparición)', () => {
    expect(leer('servicios=2,2,1,2,1')).toEqual({ ids: [2, 1], desdeCarrito: true })
  })

  it('más de 3: se conservan los 3 primeros', () => {
    expect(leer('servicios=1,2,3,4,5')).toEqual({ ids: [1, 2, 3], desdeCarrito: true })
    expect(parsearListaServicios('9,8,7,6')).toEqual([9, 8, 7])
  })

  it('un valor enorme (más de 9 dígitos) se ignora', () => {
    expect(leer('servicios=99999999999,5')).toEqual({ ids: [5], desdeCarrito: true })
  })

  it('mezcla: ?servicios= con ids válidos gana sobre ?servicio=', () => {
    expect(leer('servicio=9&servicios=1,2')).toEqual({ ids: [1, 2], desdeCarrito: true })
  })

  it('mezcla: si ?servicios= no trae nada válido se usa ?servicio=', () => {
    expect(leer('servicios=abc&servicio=9')).toEqual({ ids: [9], desdeCarrito: false })
    expect(leer('servicios=&servicio=9')).toEqual({ ids: [9], desdeCarrito: false })
  })

  it('?servicio= inválido (texto, 0, negativo, decimal) se ignora', () => {
    ;['abc', '0', '-3', '1.5', '', '1,2'].forEach((valor) => {
      expect(leer(`servicio=${encodeURIComponent(valor)}`).ids).toEqual([])
    })
  })

  it('normalizarIds y mismosIds', () => {
    expect(normalizarIds([1, 1, 2, 'x', -1, 2.5, 3, 4])).toEqual([1, 2, 3])
    expect(normalizarIds('no es lista')).toEqual([])
    expect(mismosIds([1, 2], [1, 2])).toBe(true)
    expect(mismosIds([1, 2], [2, 1])).toBe(false) // el orden importa
  })
})

describe('reservaReducer con varios servicios', () => {
  const avanzado = { ...estadoInicialReserva([1, 2], 5), paso: 'fecha-hora', fecha: '2030-06-15', hora: '10:00' }

  it('el estado inicial normaliza los ids: orden, máximo 3, sin repetidos', () => {
    expect(estadoInicialReserva([3, 1, 3, 2, 4]).servicioIds).toEqual([3, 1, 2])
    expect(estadoInicialReserva().servicioIds).toEqual([])
  })

  it('SELECCIONAR_SERVICIOS con otra lista invalida fecha y hora y conserva barbero y paso', () => {
    const nuevo = reservaReducer(avanzado, { type: 'SELECCIONAR_SERVICIOS', servicioIds: [1, 2, 3] })
    expect(nuevo.servicioIds).toEqual([1, 2, 3])
    expect(nuevo.fecha).toBe('')
    expect(nuevo.hora).toBe('')
    expect(nuevo.barberoId).toBe(5)
    expect(nuevo.paso).toBe('fecha-hora')
  })

  it('SELECCIONAR_SERVICIOS con la misma lista no invalida nada', () => {
    const nuevo = reservaReducer(avanzado, { type: 'SELECCIONAR_SERVICIOS', servicioIds: [1, 2] })
    expect(nuevo.fecha).toBe('2030-06-15')
    expect(nuevo.hora).toBe('10:00')
  })

  it('cambiar solo el orden SÍ cuenta como cambio (el servicio principal es el primero)', () => {
    const nuevo = reservaReducer(avanzado, { type: 'SELECCIONAR_SERVICIOS', servicioIds: [2, 1] })
    expect(nuevo.servicioIds).toEqual([2, 1])
    expect(nuevo.fecha).toBe('')
  })

  it('SELECCIONAR_SERVICIOS normaliza: recorta a 3, quita repetidos y basura', () => {
    const nuevo = reservaReducer(avanzado, { type: 'SELECCIONAR_SERVICIOS', servicioIds: [4, 4, 'x', 5, 6, 7] })
    expect(nuevo.servicioIds).toEqual([4, 5, 6])
  })

  it('SERVICIO_NO_DISPONIBLE con ids quita SOLO los afectados y conserva el resto', () => {
    const nuevo = reservaReducer({ ...avanzado, paso: 'confirmar' }, { type: 'SERVICIO_NO_DISPONIBLE', ids: [2] })
    expect(nuevo.servicioIds).toEqual([1])
    expect(nuevo.paso).toBe('servicio')
    expect(nuevo.fecha).toBe('')
    expect(nuevo.hora).toBe('')
    expect(nuevo.errorGlobal).toBe(MENSAJE_SERVICIOS_NO_DISPONIBLES)
    expect(nuevo.barberoId).toBe(5)
  })

  it('si el único servicio se va, el aviso es el de siempre; si se van varios, el plural', () => {
    const uno = reservaReducer(estadoInicialReserva([7]), { type: 'SERVICIO_NO_DISPONIBLE', ids: [7] })
    expect(uno.servicioIds).toEqual([])
    expect(uno.errorGlobal).toBe(MENSAJE_SERVICIO_NO_DISPONIBLE)

    const dos = reservaReducer(estadoInicialReserva([1, 2]), { type: 'SERVICIO_NO_DISPONIBLE', ids: [1, 2] })
    expect(dos.servicioIds).toEqual([])
    expect(dos.errorGlobal).toBe(MENSAJE_SERVICIOS_NO_DISPONIBLES)
  })

  it('con ids que no están en la selección no quita nada pero igual vuelve al paso Servicio con aviso', () => {
    const nuevo = reservaReducer(avanzado, { type: 'SERVICIO_NO_DISPONIBLE', ids: [99] })
    expect(nuevo.servicioIds).toEqual([1, 2])
    expect(nuevo.paso).toBe('servicio')
  })

  it('ERROR_SELECCION conserva la selección, vuelve al paso Servicio y deja el motivo', () => {
    const nuevo = reservaReducer(avanzado, { type: 'ERROR_SELECCION', mensaje: mensajeErrorSeleccion('DURACION_EXCEDIDA') })
    expect(nuevo.servicioIds).toEqual([1, 2])
    expect(nuevo.paso).toBe('servicio')
    expect(nuevo.fecha).toBe('')
    expect(nuevo.errorGlobal).toMatch(/240 min/)
  })

  it('mensajes para los códigos del servidor sobre la selección', () => {
    expect(mensajeErrorSeleccion('SERVICIOS_REPETIDOS')).toMatch(/repetir/)
    expect(mensajeErrorSeleccion('LIMITE_SERVICIOS')).toMatch(/máximo 3/)
    expect(mensajeErrorSeleccion('DURACION_EXCEDIDA')).toMatch(/240 min/)
    expect(mensajeErrorSeleccion('OTRO_CODIGO')).toBeUndefined()
  })

  it('no muta el estado anterior', () => {
    const copia = structuredClone(avanzado)
    reservaReducer(avanzado, { type: 'SERVICIO_NO_DISPONIBLE', ids: [1] })
    reservaReducer(avanzado, { type: 'SELECCIONAR_SERVICIOS', servicioIds: [3] })
    expect(avanzado).toEqual(copia)
  })
})
