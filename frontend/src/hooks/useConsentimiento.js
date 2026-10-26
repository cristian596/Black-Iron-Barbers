import { useSyncExternalStore } from 'react'
import {
  obtenerConsentimiento,
  panelCookiesAbierto,
  suscribirConsentimiento,
} from '../utils/consentimiento'

// Estado del consentimiento de cookies: `decision` ({ version, analiticas, fecha } o null si falta decidir),
// `analiticas` (true solo con consentimiento vigente) y `panelAbierto`.
export const useConsentimiento = () => {
  const decision = useSyncExternalStore(suscribirConsentimiento, obtenerConsentimiento)
  const panelAbierto = useSyncExternalStore(suscribirConsentimiento, panelCookiesAbierto)
  return { decision, analiticas: decision?.analiticas === true, panelAbierto }
}
