export const hoyISO = () => new Date().toISOString().slice(0, 10)

export const soloFecha = (fecha) => (typeof fecha === 'string' ? fecha.slice(0, 10) : '')

export const soloHora = (hora) => (typeof hora === 'string' ? hora.slice(0, 5) : '')

export const fechaLegible = (fecha) => {
  const iso = soloFecha(fecha)
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}
