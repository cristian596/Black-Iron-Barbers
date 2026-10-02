import { useEffect, useState } from 'react'
import { interpolar, puedeAnimar } from '../utils/conteo'

// Cuenta de 0 a `hasta` en `duracion` ms con requestAnimationFrame cuando
// `activo` es true y hay un valor. Con movimiento reducido (o sin
// IntersectionObserver) devuelve el valor final sin animar.
const useContarAlVer = (hasta, { activo, duracion = 1800, retraso = 0 }) => {
  const [sinAnimar] = useState(() => !puedeAnimar())
  const [valor, setValor] = useState(0)

  useEffect(() => {
    if (sinAnimar || !activo || !(hasta > 0)) return undefined

    let frame
    let inicio = null
    const paso = (ahora) => {
      if (inicio === null) inicio = ahora
      const progreso = (ahora - inicio - retraso) / duracion
      setValor(interpolar(progreso, hasta))
      if (progreso < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [sinAnimar, activo, hasta, duracion, retraso])

  return sinAnimar ? hasta : valor
}

export default useContarAlVer
