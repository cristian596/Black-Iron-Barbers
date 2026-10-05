import { useAuth } from '../../context/AuthContext'
import { useConfirmarCierreSesion } from '../../hooks/useConfirmarCierreSesion'
import { SECCIONES_ADMIN } from '../../data/menuAdmin'
import LayoutPanel from '../../components/admin/LayoutPanel'
import BuscadorCitas from '../../components/admin/BuscadorCitas'
import MenuUsuario from '../../components/admin/MenuUsuario'

// Dashboard del administrador: la estructura es la de LayoutPanel (compartida con el panel del barbero).
// "Cerrar sesión" está en la barra lateral y en el menú de usuario (junto a "Cambiar contraseña"); ambos piden confirmación.
const AdminLayout = () => {
  const { usuario, token } = useAuth()
  const { pedirCierreSesion, dialogoCierreSesion, cierreAbierto } = useConfirmarCierreSesion()

  return (
    <>
      <LayoutPanel
        secciones={SECCIONES_ADMIN}
        centroBarra={<BuscadorCitas />}
        derechaBarra={<MenuUsuario usuario={usuario} token={token} alCerrarSesion={pedirCierreSesion} />}
        alCerrarSesion={pedirCierreSesion}
        cajonPausado={cierreAbierto}
      />
      {dialogoCierreSesion}
    </>
  )
}

export default AdminLayout
