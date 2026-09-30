import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-lg font-medium">Cargando sesión...</p>
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login-barberos" replace />
  }

  return children
}

export default ProtectedRoute
