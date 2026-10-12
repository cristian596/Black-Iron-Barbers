import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { obtenerCambiosPerfil } from '../services/api'

const CambiosPerfilContext = createContext(null)

const INTERVALO_REFRESCO_MS = 60_000
const SIN_CAMBIOS = { cargando: false, error: '', total: 0, barberos: [], recargar: () => {}, descartar: () => {} }

// Estado compartido del admin con los cambios de perfil (nombre y foto del dashboard) que han hecho los barberos y
// aún no ha revisado: UNA sola petición a /api/admin/cambios-perfil que usan el aviso persistente y la vista de
// revisión de /admin/configuracion. Igual que el resumen del barbero, se vuelve a pedir:
//   · con `recargar()` (tras marcar como revisado o restablecer),
//   · al volver a la pestaña (visibilitychange) y
//   · cada 60 s mientras la pestaña está visible.
// Cada ciclo cancela el anterior (AbortController + bandera `vigente`): una respuesta vieja nunca pisa a una nueva y
// al desmontar no queda nada en vuelo. Si un refresco falla se conservan los datos anteriores.
// `descartar(barberoId)` quita al barbero de la lista al instante (tras una acción correcta); `recargar()` confirma.
export const ProveedorCambiosPerfil = ({ token, children }) => {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: '' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controlador = new AbortController()
    let vigente = true
    const cargar = async () => {
      setEstado((previo) => ({ ...previo, cargando: true, error: '' }))
      try {
        const datos = await obtenerCambiosPerfil(token, controlador.signal)
        if (vigente) setEstado({ datos: datos ?? { total_barberos: 0, barberos: [] }, cargando: false, error: '' })
      } catch (err) {
        if (vigente && err?.name !== 'AbortError') setEstado((previo) => ({ ...previo, cargando: false, error: err.message }))
      }
    }
    cargar()
    return () => {
      vigente = false
      controlador.abort()
    }
  }, [token, version])

  const recargar = useCallback(() => setVersion((n) => n + 1), [])

  const descartar = useCallback((barberoId) => {
    setEstado((previo) => {
      if (!previo.datos) return previo
      const barberos = previo.datos.barberos.filter((b) => b.barbero_id !== barberoId)
      return { ...previo, datos: { total_barberos: barberos.length, barberos } }
    })
  }, [])

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

  const valor = useMemo(
    () => ({
      cargando: estado.cargando,
      error: estado.error,
      cargado: estado.datos !== null,
      total: estado.datos?.total_barberos ?? 0,
      barberos: estado.datos?.barberos ?? [],
      recargar,
      descartar,
    }),
    [estado, recargar, descartar]
  )

  return <CambiosPerfilContext.Provider value={valor}>{children}</CambiosPerfilContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCambiosPerfil = () => useContext(CambiosPerfilContext) ?? SIN_CAMBIOS
