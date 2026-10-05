import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ResumenBarberoProvider, useResumenBarbero } from '../../context/ResumenBarberoContext'
import { useBarberosActivos } from '../../hooks/useBarberosActivos'
import { useConfirmarCierreSesion } from '../../hooks/useConfirmarCierreSesion'
import { obtenerSesion } from '../../services/api'
import { SECCIONES_BARBERO } from '../../data/menuBarbero'
import { bienvenidaYaMostrada, marcarBienvenidaMostrada } from '../../utils/bienvenida'
import LayoutPanel from '../../components/admin/LayoutPanel'
import MenuUsuario from '../../components/admin/MenuUsuario'
import AvisoCaducidad from '../../components/dashboard/AvisoCaducidad'
import CambioObligatorio from '../../components/dashboard/CambioObligatorio'
import PerfilBarbero from '../../components/panel/PerfilBarbero'
import AvisoPorConfirmar from '../../components/panel/AvisoPorConfirmar'
import VentanaBienvenida from '../../components/panel/VentanaBienvenida'
import CargandoPagina from '../../components/ui/CargandoPagina'

// Parte del layout que ya tiene el resumen compartido: ventana de bienvenida (una vez por inicio de sesión) y aviso
// persistente de citas por confirmar. Solo existen dentro de /panel (este componente solo se monta ahí).
const ContenidoPanel = () => {
  const { token, vigencia, actualizarVigencia } = useAuth()
  const { resumen, porConfirmar, barbero } = useResumenBarbero()
  const { pedirCierreSesion, dialogoCierreSesion, cierreAbierto } = useConfirmarCierreSesion()
  // En /panel/cuenta el aviso (con su formulario) va dentro de la propia página: así nunca hay dos formularios a la vez.
  const enCuenta = useLocation().pathname === '/panel/cuenta'
  const [contrasenaCambiada, setContrasenaCambiada] = useState(false)
  // La bienvenida sale una vez por inicio de sesión: al montar se lee la marca de sessionStorage (se borra al cerrar
  // sesión), y cuando la ventana se muestra se escribe, así que recargar la página no la repite.
  const [yaVista] = useState(bienvenidaYaMostrada)
  const [cerrada, setCerrada] = useState(false)
  const verBienvenida = Boolean(resumen && porConfirmar) && !yaVista && !cerrada
  useEffect(() => {
    if (verBienvenida) marcarBienvenidaMostrada()
  }, [verBienvenida])

  const alCambiarContrasena = (respuesta) => {
    actualizarVigencia(respuesta.vigencia)
    setContrasenaCambiada(true)
  }

  const porConfirmarAhora = resumen?.por_confirmar ?? 0

  const encabezado = (
    <>
      {vigencia?.estado === 'por_vencer' && !enCuenta && <AvisoCaducidad vigencia={vigencia} token={token} alCambiada={alCambiarContrasena} />}
      <p className="rounded-lg bg-green-900/40 p-3 text-green-300 empty:hidden" role="status">
        {contrasenaCambiada ? 'Contraseña actualizada. La nueva vale 60 días.' : ''}
      </p>
    </>
  )

  return (
    <>
    <LayoutPanel
      secciones={SECCIONES_BARBERO}
      tarjeta={<PerfilBarbero barbero={barbero} />}
      derechaBarra={
        <MenuUsuario usuario={{ usuario: barbero.nombre }} etiquetaRol="Barbero" conCambioContrasena={false} alCerrarSesion={pedirCierreSesion} />
      }
      alCerrarSesion={pedirCierreSesion}
      cajonPausado={cierreAbierto}
      encabezado={encabezado}
      espacioInferior={porConfirmarAhora > 0}
      superpuestos={
        <>
          <AvisoPorConfirmar cantidad={porConfirmarAhora} />
          {verBienvenida && (
            <VentanaBienvenida nombre={barbero.nombre} resumen={resumen} porConfirmar={porConfirmar} alCerrar={() => setCerrada(true)} />
          )}
        </>
      }
    />
    {dialogoCierreSesion}
    </>
  )
}

// Layout de /panel (el guard ProtectedRoute + RoleRoute "barbero" está una vez en AppRouter). Prioridad:
//   1. contraseña caducada → pantalla obligatoria de cambio (bloquea todo; ni siquiera se piden datos),
//   2. ventana de bienvenida (dentro de ContenidoPanel, sobre el contenido),
//   3. contenido.
// Tras recargar la página la vigencia no se conoce (undefined): se consulta /auth/sesion antes de mostrar nada.
const PanelLayout = () => {
  const { usuario, token, vigencia, actualizarVigencia } = useAuth()
  const { pedirCierreSesion, dialogoCierreSesion } = useConfirmarCierreSesion()
  const { barberosActivos } = useBarberosActivos()

  useEffect(() => {
    if (vigencia !== undefined) return undefined
    let activo = true
    obtenerSesion(token)
      .then((datos) => activo && actualizarVigencia(datos.vigencia))
      // Sin respuesta se muestra el panel: el back-end sigue bloqueando todo si la contraseña está caducada
      // y ese 403 lleva igualmente a la pantalla obligatoria.
      .catch(() => activo && actualizarVigencia(null))
    return () => {
      activo = false
    }
  }, [token, vigencia, actualizarVigencia])

  if (vigencia === undefined) return <CargandoPagina />

  if (vigencia?.estado === 'caducada') {
    return (
      <>
        <CambioObligatorio token={token} alCambiada={(respuesta) => actualizarVigencia(respuesta.vigencia)} alCerrarSesion={pedirCierreSesion} />
        {dialogoCierreSesion}
      </>
    )
  }

  // Nombre, cargo y foto salen de la lista pública de barberos activos; sin ella se usa el nombre de usuario.
  const barbero = barberosActivos.find((b) => b.id === usuario.barbero_id) ?? { id: usuario.barbero_id, nombre: usuario.usuario, cargo: '', foto: null }

  return (
    <ResumenBarberoProvider token={token} barbero={barbero}>
      <ContenidoPanel />
    </ResumenBarberoProvider>
  )
}

export default PanelLayout
