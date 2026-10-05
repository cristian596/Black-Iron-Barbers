import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setUnauthorizedHandler, setContrasenaCaducadaHandler } from '../services/api'
import { olvidarBienvenida } from '../utils/bienvenida'

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
// `sesionExpirada`: la sesión terminó sin que el usuario la cerrara (401 con token o token vencido); solo en memoria,
// la pantalla de acceso lo muestra como aviso. No guarda nada sensible.
const SIN_SESION = { token: null, usuario: null, vigencia: null, sesionExpirada: false }

const restaurarSesion = () => {
  const tokenGuardado = localStorage.getItem('token')
  if (!tokenGuardado) return SIN_SESION

  const payload = decodificarToken(tokenGuardado)
  if (!payload || tokenVencido(payload)) {
    localStorage.removeItem('token')
    return { ...SIN_SESION, sesionExpirada: true }
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
    olvidarBienvenida() // el siguiente inicio de sesión vuelve a mostrar la ventana de bienvenida
    setSesion(SIN_SESION)
  }, [])

  // Cierre no pedido por el usuario (401 de una petición con token): igual que logout, pero deja el motivo para el login.
  const expirarSesion = useCallback(() => {
    localStorage.removeItem('token')
    olvidarBienvenida()
    setSesion({ ...SIN_SESION, sesionExpirada: true })
  }, [])

  const actualizarVigencia = useCallback((vigencia) => {
    setSesion((actual) => ({ ...actual, vigencia }))
  }, [])

  const login = useCallback((data) => {
    localStorage.setItem('token', data.token)
    olvidarBienvenida() // cada inicio de sesión muestra la ventana de bienvenida una vez
    setSesion({
      token: data.token,
      usuario: {
        id: data.usuario.id,
        usuario: data.usuario.usuario,
        rol: data.usuario.rol,
        barbero_id: data.usuario.barbero_id,
      },
      vigencia: data.vigencia ?? null,
      sesionExpirada: false,
    })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(expirarSesion)
    return () => setUnauthorizedHandler(null)
  }, [expirarSesion])

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
      value={{ token: sesion.token, usuario: sesion.usuario, vigencia: sesion.vigencia, sesionExpirada: sesion.sesionExpirada, actualizarVigencia, cargando, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
