import { useCallback, useEffect, useRef, useState } from 'react'

// Carga datos asíncronos y los vuelve a pedir cuando cambia `clave` (texto que identifica los parámetros).
// Mientras llega la nueva respuesta conserva los datos anteriores (evita parpadeos al escribir en un filtro) y
// descarta respuestas viejas si la clave ya cambió. `recargar()` vuelve a pedir con la misma clave.
export const useCarga = (cargador, clave) => {
  const cargadorRef = useRef(cargador)
  useEffect(() => {
    cargadorRef.current = cargador
  })

  const [estado, setEstado] = useState({ datos: null, cargando: true, error: '' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    const cargar = async () => {
      setEstado((previo) => ({ ...previo, cargando: true, error: '' }))
      try {
        const datos = await cargadorRef.current()
        if (vigente) setEstado({ datos: datos ?? null, cargando: false, error: '' })
      } catch (err) {
        if (vigente) setEstado({ datos: null, cargando: false, error: err.message })
      }
    }
    cargar()
    return () => {
      vigente = false
    }
  }, [clave, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  return { ...estado, recargar }
}
