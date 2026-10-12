import { useCallback, useEffect, useState } from 'react'

// Cuenta atrás en segundos. `iniciar(n)` la arranca; `restante` llega a 0 al terminar. Se calcula contra la hora de fin
// (no restando de 1 en 1) para que una pestaña en segundo plano no se atrase.
export const useCuentaAtras = () => {
  const [fin, setFin] = useState(null)
  const [restante, setRestante] = useState(0)

  useEffect(() => {
    if (fin === null) return undefined
    const tick = () => {
      const faltan = Math.max(0, Math.ceil((fin - Date.now()) / 1000))
      setRestante(faltan)
      if (faltan === 0) setFin(null)
    }
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fin])

  const iniciar = useCallback((segundos) => {
    setRestante(segundos)
    setFin(Date.now() + segundos * 1000)
  }, [])

  const detener = useCallback(() => {
    setFin(null)
    setRestante(0)
  }, [])

  return { restante, iniciar, detener }
}
