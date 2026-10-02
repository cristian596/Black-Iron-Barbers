// Datos del negocio: única fuente para el inicio.
export const negocio = {
  ciudad: 'Facatativá',
  direccion: 'Cll 22 #1 A 69 sur, Prado Cartagenita',
  horario: 'Todos los días y festivos · 9 a. m. – 6 p. m.',
}

// Cifras de la sección de estadísticas (datos ficticios de portafolio).
// La cifra de barberos no tiene valor fijo: viene de la API (desdeApi) para
// coincidir siempre con el hero.
export const ESTADISTICAS = [
  { id: 'clientes', etiqueta: 'Clientes', valor: 6, prefijo: '+', sufijo: 'K' },
  { id: 'barberos', etiqueta: 'Barberos', desdeApi: true },
  { id: 'anios', etiqueta: 'Años', valor: 6 },
  { id: 'locales', etiqueta: 'Locales', valor: 2 },
]
