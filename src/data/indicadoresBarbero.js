import { vocabularioPanel } from '../utils/areas'

// Las cuatro tarjetas de "Mi rendimiento" (mismas claves que las del admin, con el vocabulario del barbero).
// `indicadoresBarbero(area)` cambia solo la etiqueta de la primera ("Cortes" / "Asesorías") según el área del profesional.
export const indicadoresBarbero = (area) => [
  { clave: 'completadas', etiqueta: vocabularioPanel(area).etiquetaTotal, formato: 'numero' },
  { clave: 'ingresos', etiqueta: 'Ingresos', formato: 'dinero' },
  { clave: 'ticket_promedio', etiqueta: 'Ticket promedio', formato: 'dinero' },
  { clave: 'canceladas', etiqueta: 'Canceladas', formato: 'numero', invertir: true },
]

export const INDICADORES_BARBERO = indicadoresBarbero('barberia')
