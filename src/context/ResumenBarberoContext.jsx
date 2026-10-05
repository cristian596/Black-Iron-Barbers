import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { obtenerResumenBarbero, obtenerCitasPorConfirmar } from '../services/api'

const ResumenBarberoContext = createContext(null)

const INTERVALO_REFRESCO_MS = 60_000

// Estado compartido del panel del barbero: UNA sola petición a /api/barbero/resumen (y a citas-por-confirmar, en
// paralelo) que usan la ventana de bienvenida, el aviso persistente y la pantalla Resumen. Se vuelve a pedir:
//   · con `recargar()` (tras completar o cancelar una cita),
//   · al volver a la pestaña (visibilitychange) y
//   · cada 60 s mientras la pestaña está visible (una cita puede vencerse con el panel abierto).
// Cada ciclo cancela el anterior (AbortController + bandera `vigente`): una respuesta vieja nunca pisa a una nueva
// y al desmontar no queda nada en vuelo. Si un refresco falla se conservan los datos anteriores.
// `version` cambia con cada ciclo: otras partes del panel (la agenda de hoy) lo usan como clave para recargarse a la par.
export const ResumenBarberoProvider = ({ token, barbero, children }) => {
  const [estado, setEstado] = useState({ resumen: null, porConfirmar: null, cargando: true, error: '' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controlador = new AbortController()
    let vigente = true
    const cargar = async () => {
      setEstado((previo) => ({ ...previo, cargando: true, error: '' }))
      try {
        const [resumen, porConfirmar] = await Promise.all([
          obtenerResumenBarbero(token, controlador.signal),
          obtenerCitasPorConfirmar(token, controlador.signal),
        ])
        if (vigente) setEstado({ resumen, porConfirmar, cargando: false, error: '' })
      } catch (err) {
        if (vigente) setEstado((previo) => ({ ...previo, cargando: false, error: err.message }))
      }
    }
    cargar()
    return () => {
      vigente = false
      controlador.abort()
    }
  }, [token, version])

  const recargar = useCallback(() => setVersion((n) => n + 1), [])

  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    const temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') recargar()
    }, INTERVALO_REFRESCO_MS)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      clearInterval(temporizador)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [recargar])

  const valor = useMemo(() => ({ ...estado, version, recargar, barbero, token }), [estado, version, recargar, barbero, token])

  return <ResumenBarberoContext.Provider value={valor}>{children}</ResumenBarberoContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useResumenBarbero = () => {
  const contexto = useContext(ResumenBarberoContext)
  if (!contexto) throw new Error('useResumenBarbero solo se puede usar dentro de ResumenBarberoProvider')
  return contexto
}
