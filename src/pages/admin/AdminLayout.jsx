import { useAuth } from '../../context/AuthContext'
import { ProveedorPerfil, usePerfil } from '../../context/PerfilContext'
import { useConfirmarCierreSesion } from '../../hooks/useConfirmarCierreSesion'
import { SECCIONES_ADMIN } from '../../data/menuAdmin'
import { resolverUrlFoto } from '../../utils/perfil'
import LayoutPanel from '../../components/admin/LayoutPanel'
import BuscadorCitas from '../../components/admin/BuscadorCitas'
import MenuUsuario from '../../components/admin/MenuUsuario'

const ContenidoAdmin = () => {
  const { usuario, token } = useAuth()
  const { perfil } = usePerfil()
  const { pedirCierreSesion, dialogoCierreSesion, cierreAbierto } = useConfirmarCierreSesion()
  // Nombre y foto de perfil (solo del dashboard); sin ellos, el usuario de acceso y las iniciales de siempre.
  const nombre = perfil?.nombre ?? usuario.usuario

  return (
    <>
      <LayoutPanel
        secciones={SECCIONES_ADMIN}
        centroBarra={<BuscadorCitas />}
        derechaBarra={
          <MenuUsuario
            usuario={{ ...usuario, usuario: nombre }}
            foto={resolverUrlFoto(perfil)}
            token={token}
            rutaConfiguracion="/admin/configuracion"
            alCerrarSesion={pedirCierreSesion}
          />
        }
        alCerrarSesion={pedirCierreSesion}
        cajonPausado={cierreAbierto}
      />
      {dialogoCierreSesion}
    </>
  )
}

// Dashboard del administrador: la estructura es la de LayoutPanel (compartida con el panel del barbero).
// "Cerrar sesión" está en la barra lateral y en el menú de usuario (junto a "Cambiar contraseña"); ambos piden confirmación.
// El perfil (nombre y foto del dashboard) se pide una vez aquí; el admin no caduca, así que nunca está bloqueado.
const AdminLayout = () => {
  const { usuario, token } = useAuth()

  return (
    <ProveedorPerfil token={token} nombrePublico={usuario.usuario}>
      <ContenidoAdmin />
    </ProveedorPerfil>
  )
}

export default AdminLayout
