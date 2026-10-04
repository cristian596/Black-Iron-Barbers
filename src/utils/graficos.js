// Escala "bonita" para el eje Y: devuelve el máximo (múltiplo de 4 divisiones) que deja 4 tramos iguales
// con valores redondos. Sin datos (o todo en cero) usa una escala de ejemplo para que el eje no quede vacío.
export const escalaEje = (maximo, divisiones = 4) => {
  if (!Number.isFinite(maximo) || maximo <= 0) return { max: 100000, paso: 100000 / divisiones }
  const bruto = maximo / divisiones
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)
  return { max: paso * divisiones, paso }
}

// $250 mil · $1,5 M — para las marcas del eje.
export const abreviarPesos = (valor) => {
  if (valor === 0) return '$0'
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (valor >= 1_000) return `$${(valor / 1_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mil`
  return `$${valor}`
}

export const recortarTexto = (texto, maximo) =>
  texto.length <= maximo ? texto : `${texto.slice(0, Math.max(1, maximo - 1)).trimEnd()}…`
