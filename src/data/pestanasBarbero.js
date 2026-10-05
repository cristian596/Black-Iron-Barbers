// Pestañas de /panel/citas (los ids son los de GET /api/barbero/citas?pestana=). `destacar`: con conteo > 0 la
// insignia de la pestaña llama la atención (citas por confirmar).
export const PESTANAS_BARBERO = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'proximas', etiqueta: 'Próximas' },
  { id: 'por_confirmar', etiqueta: 'Por confirmar', destacar: true },
  { id: 'completadas', etiqueta: 'Completadas' },
  { id: 'canceladas', etiqueta: 'Canceladas' },
  { id: 'todas', etiqueta: 'Todas' },
]
