import { LEGAL } from '../data/legal'

// Consentimiento de cookies: { version, analiticas, fecha }. Las cookies necesarias están siempre activas y no se
// guardan como opción. Vive en localStorage (con try/catch en toda lectura y escritura; si falla, solo en memoria) y es
// un almacén de módulo (useSyncExternalStore, ver hooks/useConsentimiento.js): no necesita proveedor.
export const CLAVE_CONSENTIMIENTO = 'consentimiento-cookies'
// Si la versión guardada no coincide con la de las políticas, se vuelve a preguntar.
export const VERSION_CONSENTIMIENTO = LEGAL.version

let decision = null
let cargada = false
let panelAbierto = false
const oyentes = new Set()

const avisar = () => oyentes.forEach((oyente) => oyente())

const esDecisionValida = (valor) =>
  Boolean(valor) &&
  typeof valor === 'object' &&
  valor.version === VERSION_CONSENTIMIENTO &&
  typeof valor.analiticas === 'boolean' &&
  typeof valor.fecha === 'string'

const leerAlmacenada = () => {
  try {
    const crudo = localStorage.getItem(CLAVE_CONSENTIMIENTO)
    if (!crudo) return null
    const valor = JSON.parse(crudo)
    return esDecisionValida(valor)
      ? { version: valor.version, analiticas: valor.analiticas, fecha: valor.fecha }
      : null
  } catch {
    return null // sin storage o JSON roto: como si no hubiera decisión
  }
}

// Decisión vigente o null (sin decidir o de otra versión). Estable entre llamadas (para useSyncExternalStore).
export const obtenerConsentimiento = () => {
  if (!cargada) {
    decision = leerAlmacenada()
    cargada = true
  }
  return decision
}

export const hayConsentimientoAnaliticas = () => obtenerConsentimiento()?.analiticas === true

export const guardarConsentimiento = ({ analiticas }) => {
  decision = { version: VERSION_CONSENTIMIENTO, analiticas: analiticas === true, fecha: new Date().toISOString() }
  cargada = true
  try {
    localStorage.setItem(CLAVE_CONSENTIMIENTO, JSON.stringify(decision))
  } catch {
    // sin localStorage: la decisión dura lo que dure la página
  }
  avisar()
  return decision
}

export const suscribirConsentimiento = (oyente) => {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

// Panel de configuración (modal): abierto desde el banner y desde el pie.
export const panelCookiesAbierto = () => panelAbierto

export const abrirPanelCookies = () => {
  panelAbierto = true
  avisar()
}

export const cerrarPanelCookies = () => {
  if (!panelAbierto) return
  panelAbierto = false
  avisar()
}

// Solo para pruebas: vuelve al estado inicial (vuelve a leer el almacenamiento).
export const reiniciarConsentimiento = () => {
  decision = null
  cargada = false
  panelAbierto = false
  avisar()
}
