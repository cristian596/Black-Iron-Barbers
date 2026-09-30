import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setUnauthorizedHandler } from '../services/api'

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

const restaurarSesion = () => {
  const tokenGuardado = localStorage.getItem('token')
  if (!tokenGuardado) return { token: null, usuario: null }

  const payload = decodificarToken(tokenGuardado)
  if (!payload || tokenVencido(payload)) {
    localStorage.removeItem('token')
    return { token: null, usuario: null }
  }

  return {
    token: tokenGuardado,
    usuario: { id: payload.id, rol: payload.rol, barbero_id: payload.barbero_id },
  }
}

export const AuthProvider = ({ children }) => {
  const [sesion, setSesion] = useState(restaurarSesion)
  const [cargando] = useState(false)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setSesion({ token: null, usuario: null })
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
    })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  return (
    <AuthContext.Provider
      value={{ token: sesion.token, usuario: sesion.usuario, cargando, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
