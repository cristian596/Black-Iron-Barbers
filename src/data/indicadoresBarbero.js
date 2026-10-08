import { campoConteo, vocabularioPanel } from '../utils/areas'

// Las cuatro tarjetas de "Mi rendimiento" (mismas claves que las del admin, con el vocabulario del barbero).
// `indicadoresBarbero(area)` cambia la etiqueta de la primera ("Cortes" / "Asesorías") y qué cuenta: los cortes o las
// asesorías del profesional según su área (`respaldo`: `completadas`, para respuestas que no traen el desglose).
export const indicadoresBarbero = (area) => [
  { clave: campoConteo(area), respaldo: 'completadas', etiqueta: vocabularioPanel(area).etiquetaTotal, formato: 'numero' },
  { clave: 'ingresos', etiqueta: 'Ingresos', formato: 'dinero' },
  { clave: 'ticket_promedio', etiqueta: 'Ticket promedio', formato: 'dinero' },
  { clave: 'canceladas', etiqueta: 'Canceladas', formato: 'numero', invertir: true },
]

export const INDICADORES_BARBERO = indicadoresBarbero('barberia')
