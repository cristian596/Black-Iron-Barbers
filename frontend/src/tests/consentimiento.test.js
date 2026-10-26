import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CLAVE_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  abrirPanelCookies,
  cerrarPanelCookies,
  guardarConsentimiento,
  hayConsentimientoAnaliticas,
  obtenerConsentimiento,
  panelCookiesAbierto,
  reiniciarConsentimiento,
  suscribirConsentimiento,
} from '../utils/consentimiento'

beforeEach(() => {
  localStorage.clear()
  reiniciarConsentimiento()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('consentimiento de cookies: almacén', () => {
  it('por defecto no hay decisión y las analíticas están desactivadas', () => {
    expect(obtenerConsentimiento()).toBeNull()
    expect(hayConsentimientoAnaliticas()).toBe(false)
  })

  it('guarda { version, analiticas, fecha } en localStorage y lo devuelve', () => {
    const guardada = guardarConsentimiento({ analiticas: true })

    expect(guardada).toEqual({ version: VERSION_CONSENTIMIENTO, analiticas: true, fecha: expect.any(String) })
    expect(Number.isNaN(Date.parse(guardada.fecha))).toBe(false)
    expect(JSON.parse(localStorage.getItem(CLAVE_CONSENTIMIENTO))).toEqual(guardada)
    expect(obtenerConsentimiento()).toEqual(guardada)
    expect(hayConsentimientoAnaliticas()).toBe(true)
  })

  it('rechazar guarda analiticas=false (también es una decisión)', () => {
    guardarConsentimiento({ analiticas: false })
    expect(obtenerConsentimiento()).toMatchObject({ analiticas: false })
    expect(hayConsentimientoAnaliticas()).toBe(false)
  })

  it('al recargar (volver a leer) recupera la decisión guardada', () => {
    const guardada = guardarConsentimiento({ analiticas: true })
    reiniciarConsentimiento()
    expect(obtenerConsentimiento()).toEqual(guardada)
  })

  it('si la versión guardada no es la actual, vuelve a preguntar', () => {
    localStorage.setItem(
      CLAVE_CONSENTIMIENTO,
      JSON.stringify({ version: 'versión-antigua', analiticas: true, fecha: '2020-01-01T00:00:00.000Z' })
    )
    reiniciarConsentimiento()
    expect(obtenerConsentimiento()).toBeNull()
    expect(hayConsentimientoAnaliticas()).toBe(false)
  })

  it.each([
    ['JSON roto', '{no es json'],
    ['sin analiticas booleano', JSON.stringify({ version: VERSION_CONSENTIMIENTO, analiticas: 'si', fecha: 'x' })],
    ['sin fecha', JSON.stringify({ version: VERSION_CONSENTIMIENTO, analiticas: true })],
    ['no es un objeto', '"hola"'],
  ])('un valor guardado inválido (%s) se trata como sin decisión', (_n, crudo) => {
    localStorage.setItem(CLAVE_CONSENTIMIENTO, crudo)
    reiniciarConsentimiento()
    expect(obtenerConsentimiento()).toBeNull()
  })

  it('si localStorage falla al leer y al escribir, funciona en memoria', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    reiniciarConsentimiento()

    expect(obtenerConsentimiento()).toBeNull()
    expect(() => guardarConsentimiento({ analiticas: true })).not.toThrow()
    expect(obtenerConsentimiento()).toMatchObject({ analiticas: true })
    expect(hayConsentimientoAnaliticas()).toBe(true)
  })

  it('avisa a los suscritos al guardar y al abrir o cerrar el panel', () => {
    const oyente = vi.fn()
    const cancelar = suscribirConsentimiento(oyente)

    guardarConsentimiento({ analiticas: true })
    expect(oyente).toHaveBeenCalledTimes(1)

    abrirPanelCookies()
    expect(panelCookiesAbierto()).toBe(true)
    cerrarPanelCookies()
    expect(panelCookiesAbierto()).toBe(false)
    expect(oyente).toHaveBeenCalledTimes(3)

    cancelar()
    guardarConsentimiento({ analiticas: false })
    expect(oyente).toHaveBeenCalledTimes(3)
  })
})
