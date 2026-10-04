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

// Fecha de calendario real en formato AAAA-MM-DD ('2026-02-31' no existe).
export const esFechaISO = (valor) => {
  if (typeof valor !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(valor)) return false
  const [anio, mes, dia] = valor.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10) === valor
}

// "4 oct" para un día; "28 sep – 4 oct" para un rango (fechas AAAA-MM-DD).
export const formatearRango = ({ desde, hasta }) => {
  const corta = (iso) => {
    const [anio, mes, dia] = iso.split('-').map(Number)
    const abreviatura = new Date(Date.UTC(anio, mes - 1, dia))
      .toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' })
      .replace('.', '')
    return `${dia} ${abreviatura}`
  }
  return desde === hasta ? corta(desde) : `${corta(desde)} – ${corta(hasta)}`
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
