// Mismo criterio que el back-end (backend/utils/fechas.js): "hoy" se calcula en
// America/Bogota explícitamente, sin depender de la zona horaria del navegador.
const ZONA_HORARIA = 'America/Bogota'

export const hoyISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

// Aritmética de fechas en UTC puro: evita que sumar/restar días se desfase por
// la zona horaria local del navegador (la fecha es un dato de calendario, no un instante).
export const sumarDiasISO = (fechaISO, dias) => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

// Acepta tanto 'AAAA-MM-DD' como el datetime ISO que devuelve una columna DATE
// de Postgres via la API (p. ej. '2026-12-01T05:00:00.000Z'); solo usa la fecha.
export const formatearFechaLegible = (valor) => {
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export const formatearFechaChip = (fechaISO) => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return {
    diaSemana: fecha.toLocaleDateString('es-CO', { weekday: 'short', timeZone: 'UTC' }).replace('.', ''),
    dia,
    mes: fecha.toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
  }
}
