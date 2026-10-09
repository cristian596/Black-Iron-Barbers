import { HORARIO_ATENCION } from '../data/negocio'

// Bloques de 1 hora para elegir la hora de la reserva. Se agrupan EN EL CLIENTE las horas que devuelve
// /api/disponibilidad (rejilla de 30 min, sin cambios): un bloque [h, h+1) está disponible si hay al menos una hora de
// inicio dentro de él. Los bloques salen de HORARIO_ATENCION (src/data/negocio.js), nunca de horas escritas a mano.

const MINUTOS_BLOQUE = 60

const aMinutos = (hora) => {
  const [horas, minutos] = String(hora).slice(0, 5).split(':').map(Number)
  return horas * 60 + minutos
}

const aHHMM = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

// Bloques del día de atención: 10:00–11:00 … 19:00–20:00 con el horario actual.
export const generarBloques = () => {
  const bloques = []
  const cierre = aMinutos(HORARIO_ATENCION.cierre)
  for (let inicio = aMinutos(HORARIO_ATENCION.apertura); inicio + MINUTOS_BLOQUE <= cierre; inicio += MINUTOS_BLOQUE) {
    const fin = inicio + MINUTOS_BLOQUE
    bloques.push({
      inicio,
      fin,
      clave: aHHMM(inicio),
      etiqueta: `${aHHMM(inicio)} – ${aHHMM(fin)}`,
      corta: `${Math.floor(inicio / 60)}–${Math.floor(fin / 60)}`,
    })
  }
  return bloques
}

// Minutos desde medianoche de una hora HH:MM.
export const minutosDeHora = aMinutos

// Regla del back-end (/api/disponibilidad, hoy): solo se ofrecen inicios ESTRICTAMENTE posteriores al minuto actual de
// Bogotá, sin antelación mínima. Con la rejilla de inicios, el último inicio posible de un bloque es fin - intervalo.
// Un bloque ya pasado (hoy) es el que no puede tener ningún inicio posterior a `minutosAhora`.
export const bloquePasado = (bloque, minutosAhora) => bloque.fin - HORARIO_ATENCION.intervaloMin <= minutosAhora

// Bloques que aún tienen algún inicio posible hoy (en otras fechas pasar `minutosAhora = null`: se muestran todos).
export const bloquesVigentes = (bloques, minutosAhora) =>
  minutosAhora === null ? bloques : bloques.filter((bloque) => !bloquePasado(bloque, minutosAhora))

// Cada bloque con sus horas de inicio libres (ordenadas) y si tiene al menos una. Las horas fuera de todo bloque se ignoran.
export const agruparHorasEnBloques = (horas) =>
  generarBloques().map((bloque) => {
    const dentro = (horas ?? [])
      .filter((hora) => aMinutos(hora) >= bloque.inicio && aMinutos(hora) < bloque.fin)
      .sort((a, b) => aMinutos(a) - aMinutos(b))
    return { ...bloque, horas: dentro, disponible: dentro.length > 0 }
  })

// Bloque al que pertenece una hora exacta (o undefined si cae fuera del horario).
export const bloqueDeHora = (hora) => {
  if (!hora) return undefined
  const minutos = aMinutos(hora)
  return generarBloques().find((bloque) => minutos >= bloque.inicio && minutos < bloque.fin)
}

// Primera hora libre de un bloque, sin contar las de `excluidas`; null si no queda ninguna.
export const primeraHoraLibre = (bloque, excluidas = []) => bloque.horas.find((hora) => !excluidas.includes(hora)) ?? null

// "Bloque 10–11 · tu cita es a las 10:30" (`sujeto`: lo que se agenda: "tu cita", "tu asesoría"…).
export const textoHoraAsignada = (hora, sujeto = 'tu cita') => {
  const bloque = bloqueDeHora(hora)
  const exacta = String(hora).slice(0, 5)
  return bloque ? `Bloque ${bloque.corta} · ${sujeto} es a las ${exacta}` : `${sujeto} es a las ${exacta}`
}

// Solo el rango del bloque ("10–11"); vacío si la hora cae fuera del horario.
export const rangoBloqueDeHora = (hora) => bloqueDeHora(hora)?.corta ?? ''
