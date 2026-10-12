import { useAuth } from '../../context/AuthContext'
import { ProveedorCambiosPerfil, useCambiosPerfil } from '../../context/CambiosPerfilContext'
import { ProveedorPerfil, usePerfil } from '../../context/PerfilContext'
import { useConfirmarCierreSesion } from '../../hooks/useConfirmarCierreSesion'
import { SECCIONES_ADMIN } from '../../data/menuAdmin'
import { resolverUrlFoto } from '../../utils/perfil'
import AvisoCambiosPerfil from '../../components/admin/AvisoCambiosPerfil'
import LayoutPanel from '../../components/admin/LayoutPanel'
import BuscadorCitas from '../../components/admin/BuscadorCitas'
import MenuUsuario from '../../components/admin/MenuUsuario'

const ContenidoAdmin = () => {
  const { usuario, token } = useAuth()
  const { perfil } = usePerfil()
  const { total: cambiosPendientes } = useCambiosPerfil()
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
        superpuestos={<AvisoCambiosPerfil cantidad={cambiosPendientes} />}
        espacioInferior={cambiosPendientes > 0}
      />
      {dialogoCierreSesion}
    </>
  )
}

// Dashboard del administrador: la estructura es la de LayoutPanel (compartida con el panel del barbero).
// "Cerrar sesión" está en la barra lateral y en el menú de usuario (junto a "Cambiar contraseña"); ambos piden confirmación.
// El perfil (nombre y foto del dashboard) se pide una vez aquí; el admin no caduca, así que nunca está bloqueado.
// Los cambios de perfil de los barberos (aviso persistente en todo /admin y vista de revisión) comparten un solo estado.
const AdminLayout = () => {
  const { usuario, token } = useAuth()

  return (
    <ProveedorPerfil token={token} nombrePublico={usuario.usuario}>
      <ProveedorCambiosPerfil token={token}>
        <ContenidoAdmin />
      </ProveedorCambiosPerfil>
    </ProveedorPerfil>
  )
}

export default AdminLayout
