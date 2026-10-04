// `formato`: 'dinero' | 'numero'. `invertir`: que suba es malo (las canceladas), para colorear el delta.
export const INDICADORES = [
  { clave: 'ingresos', etiqueta: 'Ingresos', formato: 'dinero' },
  { clave: 'citas', etiqueta: 'Citas', formato: 'numero' },
  { clave: 'completadas', etiqueta: 'Completadas', formato: 'numero' },
  { clave: 'canceladas', etiqueta: 'Canceladas', formato: 'numero', invertir: true },
  { clave: 'ticket_promedio', etiqueta: 'Ticket promedio', formato: 'dinero' },
]
