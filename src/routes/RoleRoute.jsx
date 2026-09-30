import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DASHBOARD_POR_ROL = {
  admin: '/admin',
  barbero: '/panel',
}

const RoleRoute = ({ rol, children }) => {
  const { usuario } = useAuth()

  if (usuario?.rol !== rol) {
    return <Navigate to={DASHBOARD_POR_ROL[usuario?.rol] ?? '/login-barberos'} replace />
  }

  return children
}

export default RoleRoute
