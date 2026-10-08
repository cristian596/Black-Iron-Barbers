// `formato`: 'dinero' | 'numero'. `invertir`: que suba es malo (las canceladas), para colorear el delta.
// `detalle(actual)`: línea extra bajo la comparación (el desglose por área de los ingresos).
// Cortes (barbería) y asesorías van en tarjetas separadas; el ticket promedio es SOLO de barbería.
export const INDICADORES = [
  {
    clave: 'ingresos',
    etiqueta: 'Ingresos',
    formato: 'dinero',
    detalle: (actual, dinero) =>
      `Barbería ${dinero(actual.ingresos_barberia ?? actual.ingresos ?? 0)} · Asesorías ${dinero(actual.ingresos_asesoria ?? 0)}`,
  },
  { clave: 'citas', etiqueta: 'Citas', formato: 'numero' },
  { clave: 'cortes', etiqueta: 'Cortes', formato: 'numero' },
  { clave: 'asesorias', etiqueta: 'Asesorías', formato: 'numero' },
  { clave: 'canceladas', etiqueta: 'Canceladas', formato: 'numero', invertir: true },
  { clave: 'ticket_promedio', etiqueta: 'Ticket promedio de barbería', formato: 'dinero' },
]
