import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { obtenerPerfil } from '../services/api'

const PerfilContext = createContext(null)

// Valor por defecto fuera del proveedor (y mientras no hay perfil): todo cae en lo público.
const SIN_PERFIL = { perfil: null, cargando: false, error: '', nombrePublico: '', token: null, recargar: () => {}, aplicar: () => {} }

// Perfil del dashboard del usuario (nombre y foto de perfil). Una sola petición al montar el layout; después NO hay
// polling: se actualiza al guardar con `aplicar(respuesta)` (las respuestas del back-end ya traen el perfil completo).
// Cada layout lo monta SOLO cuando el panel no está bloqueado (con la contraseña caducada nunca se pide).
// `nombrePublico` es el nombre por defecto (el del barbero en la web, o el usuario del admin): lo muestra Configuración.
export const ProveedorPerfil = ({ token, nombrePublico, children }) => {
  const [estado, setEstado] = useState({ perfil: null, cargando: true, error: '' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controlador = new AbortController()
    let vigente = true
    const cargar = async () => {
      setEstado((previo) => ({ ...previo, cargando: true, error: '' }))
      try {
        const perfil = await obtenerPerfil(token, controlador.signal)
        if (vigente) setEstado({ perfil: perfil ?? null, cargando: false, error: '' })
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
  const aplicar = useCallback((perfil) => setEstado({ perfil, cargando: false, error: '' }), [])

  const valor = useMemo(() => ({ ...estado, nombrePublico, token, recargar, aplicar }), [estado, nombrePublico, token, recargar, aplicar])

  return <PerfilContext.Provider value={valor}>{children}</PerfilContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePerfil = () => useContext(PerfilContext) ?? SIN_PERFIL
