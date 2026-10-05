import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setUnauthorizedHandler, setContrasenaCaducadaHandler } from '../services/api'

const AuthContext = createContext(null)

const decodificarToken = (token) => {
  try {
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

const tokenVencido = (payload) => {
  if (!payload?.exp) return true
  return payload.exp * 1000 <= Date.now()
}

// `vigencia`: estado de la contraseña del barbero ({ estado, dias_restantes, vence_en }). `undefined` = aún no se
// sabe (sesión restaurada del navegador: el panel la consulta a /auth/sesion); `null` = no aplica (admin).
const SIN_SESION = { token: null, usuario: null, vigencia: null }

const restaurarSesion = () => {
  const tokenGuardado = localStorage.getItem('token')
  if (!tokenGuardado) return SIN_SESION

  const payload = decodificarToken(tokenGuardado)
  if (!payload || tokenVencido(payload)) {
    localStorage.removeItem('token')
    return SIN_SESION
  }

  return {
    token: tokenGuardado,
    vigencia: payload.rol === 'barbero' ? undefined : null,
    usuario: { id: payload.id, usuario: payload.usuario, rol: payload.rol, barbero_id: payload.barbero_id },
  }
}

export const AuthProvider = ({ children }) => {
  const [sesion, setSesion] = useState(restaurarSesion)
  const [cargando] = useState(false)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setSesion(SIN_SESION)
  }, [])

  const actualizarVigencia = useCallback((vigencia) => {
    setSesion((actual) => ({ ...actual, vigencia }))
  }, [])

  const login = useCallback((data) => {
    localStorage.setItem('token', data.token)
    setSesion({
      token: data.token,
      usuario: {
        id: data.usuario.id,
        usuario: data.usuario.usuario,
        rol: data.usuario.rol,
        barbero_id: data.usuario.barbero_id,
      },
      vigencia: data.vigencia ?? null,
    })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  useEffect(() => {
    setContrasenaCaducadaHandler(() =>
      setSesion((actual) =>
        actual.usuario?.rol === 'barbero'
          ? { ...actual, vigencia: { estado: 'caducada', dias_restantes: 0, vence_en: null } }
          : actual
      )
    )
    return () => setContrasenaCaducadaHandler(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ token: sesion.token, usuario: sesion.usuario, vigencia: sesion.vigencia, actualizarVigencia, cargando, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
