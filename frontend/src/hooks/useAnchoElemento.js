import { useLayoutEffect, useState } from 'react'

// Ancho en píxeles de un elemento (se actualiza al redimensionar). Los gráficos SVG lo usan para dibujar
// con 1 unidad = 1 px y que el texto conserve su tamaño real en móvil. `inicial` se usa hasta medir
// (y en entornos sin ResizeObserver, como las pruebas).
export const useAnchoElemento = (ref, inicial = 600) => {
  const [ancho, setAncho] = useState(inicial)

  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return undefined
    const medir = () => {
      const medido = Math.round(elemento.getBoundingClientRect().width)
      if (medido > 0) setAncho(medido)
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [ref])

  return ancho
}
