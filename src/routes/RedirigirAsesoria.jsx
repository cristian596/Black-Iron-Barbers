import { Navigate, useLocation } from 'react-router-dom'
import { RUTA_ASESORIAS } from '../data/asesorias'

// /asesoria (ruta antigua) → /asesorias conservando la búsqueda y el hash (p. ej. /asesoria#premium).
const RedirigirAsesoria = () => {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: RUTA_ASESORIAS, search, hash }} replace />
}

export default RedirigirAsesoria
