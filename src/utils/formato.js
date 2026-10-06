// Ingresos totales: un total en cero se muestra como $0 (formatearPrecio lo mostraría como "Gratis").
export const formatearDinero = (valor) => `$${Number(valor).toLocaleString('es-CO')}`

// Variación porcentual entre dos períodos. Sin base de comparación (período anterior en 0 o datos que no
// son números) devuelve "—": nunca NaN ni ∞.
export const formatearDelta = (actual, previo) => {
  if (!Number.isFinite(actual) || !Number.isFinite(previo) || previo === 0) {
    return { texto: '—', direccion: 'sin-base' }
  }
  const porcentaje = Math.round(((actual - previo) / previo) * 100)
  if (porcentaje === 0) return { texto: '0%', direccion: 'igual' }
  return porcentaje > 0
    ? { texto: `${porcentaje}%`, direccion: 'sube' }
    : { texto: `${Math.abs(porcentaje)}%`, direccion: 'baja' }
}

const soloFecha = (fecha) => (typeof fecha === 'string' ? fecha.slice(0, 10) : '')

export const soloHora = (hora) => (typeof hora === 'string' ? hora.slice(0, 5) : '')

export const fechaLegible = (fecha) => {
  const iso = soloFecha(fecha)
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

// Un servicio de precio 0 se muestra como "Gratis" en vez de "$0" (preparado para asesorías).
export const formatearPrecio = (precio) =>
  Number(precio) === 0 ? 'Gratis' : `$${Number(precio).toLocaleString('es-CO')}`

// "Hace" corto para el tiempo transcurrido en minutos: "40 min", "3 h", "2 días".
export const tiempoTranscurrido = (minutos) => {
  const m = Math.max(0, Math.floor(Number(minutos) || 0))
  if (m < 60) return `${m} min`
  if (m < 1440) return `${Math.floor(m / 60)} h`
  const dias = Math.floor(m / 1440)
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}

export const textoCitas = (n) => `${n} ${n === 1 ? 'cita' : 'citas'}`

// Duración en minutos legible: "45 min", "1 h", "1 h 15 min".
export const formatearDuracion = (minutos) => {
  const total = Math.max(0, Math.round(Number(minutos) || 0))
  if (total < 60) return `${total} min`
  const horas = Math.floor(total / 60)
  const resto = total % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}
