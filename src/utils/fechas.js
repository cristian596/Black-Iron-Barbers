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

// "Ahora" en Bogotá: { fecha: 'AAAA-MM-DD', minutos: minutos desde medianoche }. Nunca usa la zona del navegador
// (misma regla del back-end: horaActualBogota). `instante` solo se inyecta en las pruebas.
const FORMATO_AHORA = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const ahoraBogota = (instante = new Date()) => {
  const partes = Object.fromEntries(FORMATO_AHORA.formatToParts(instante).map(({ type, value }) => [type, value]))
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  }
}

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

const FORMATO_HORA = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA_HORARIA, hour: 'numeric', minute: '2-digit', hour12: true });
const diaBogota = (fecha) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);

// Instante ISO → "hace un momento", "hace 5 min", "hoy, 3:45 p. m.", "ayer, 9:10 a. m." o "6 oct, 3:45 p. m.", siempre en
// hora de Bogotá (no la del navegador). `ahora` solo se inyecta en las pruebas.
export const fechaRelativa = (valor, ahora = new Date()) => {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  const segundos = Math.round((ahora.getTime() - fecha.getTime()) / 1000)
  if (segundos < 60) return 'hace un momento'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  const hora = FORMATO_HORA.format(fecha)
  const hoy = diaBogota(ahora)
  const dia = diaBogota(fecha)
  if (dia === hoy) return `hoy, ${hora}`
  if (dia === sumarDiasISO(hoy, -1)) return `ayer, ${hora}`
  const corta = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA_HORARIA, day: 'numeric', month: 'short' }).format(fecha).replace('.', '')
  return `${corta}, ${hora}`
}

// Fecha y hora completas en Bogotá (para el atributo title de una fecha relativa).
export const fechaHoraBogota = (valor) =>
  new Date(valor).toLocaleString('es-CO', { timeZone: ZONA_HORARIA, dateStyle: 'long', timeStyle: 'short' })
