// El paso 'barbero' es el de profesionales: se llama Barbero (solo barbería), Asesor/a (solo asesoría) o Profesionales
// (ambos). La clave se conserva.
export const etiquetaPasoProfesional = (tieneAsesoria, tieneBarberia) => {
  if (tieneAsesoria && tieneBarberia) return 'Profesionales'
  return tieneAsesoria ? 'Asesor/a' : 'Barbero'
}

export const PASOS_RESERVA = [
  { key: 'servicio', etiqueta: 'Servicio' },
  { key: 'barbero', etiqueta: 'Barbero' },
  { key: 'fecha-hora', etiqueta: 'Fecha y hora' },
  { key: 'confirmar', etiqueta: 'Confirmar' },
]
