import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { SECCIONES_ADMIN } from '../../data/menuAdmin'
import LayoutPanel from '../../components/admin/LayoutPanel'
import BuscadorCitas from '../../components/admin/BuscadorCitas'
import MenuUsuario from '../../components/admin/MenuUsuario'

// Dashboard del administrador: la estructura es la de LayoutPanel (compartida con el panel del barbero).
const AdminLayout = () => {
  const { usuario, token, logout } = useAuth()
  const navigate = useNavigate()

  const cerrarSesion = () => {
    logout()
    navigate('/acceso')
  }

  return (
    <LayoutPanel
      secciones={SECCIONES_ADMIN}
      centroBarra={<BuscadorCitas />}
      derechaBarra={<MenuUsuario usuario={usuario} token={token} />}
      alCerrarSesion={cerrarSesion}
    />
  )
}

export default AdminLayout
