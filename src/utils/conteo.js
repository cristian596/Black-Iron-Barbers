// Funciones puras del conteo animado.

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// Valor del conteo para un progreso lineal t (0 a 1): 0 al inicio y el valor
// exacto al final, con curva de salida suave entre medias.
export const interpolar = (t, hasta) => {
  if (t <= 0) return 0
  if (t >= 1) return hasta
  return hasta * easeOutCubic(t)
}

// Texto de una cifra: prefijo + valor entero + sufijo (por ejemplo "+6K").
export const formatearCifra = ({ prefijo = '', valor, sufijo = '' }) =>
  `${prefijo}${Math.round(valor)}${sufijo}`

const prefiereMovimientoReducido = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Sin IntersectionObserver o con movimiento reducido se muestra el valor final
export const puedeAnimar = () =>
  typeof IntersectionObserver !== 'undefined' && !prefiereMovimientoReducido()
