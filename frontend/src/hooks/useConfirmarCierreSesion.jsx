import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ModalConfirmar from '../components/admin/ModalConfirmar'

// Cierre de sesión VOLUNTARIO: siempre pide confirmación (único punto de la lógica; los botones de "Cerrar sesión"
// solo llaman a `pedirCierreSesion`). El cierre automático (401, token vencido, contraseña caducada) NO pasa por aquí:
// sigue usando `expirarSesion` de AuthContext.
// `pedirCierreSesion` acepta el elemento que abre el diálogo (o el evento de clic): a él vuelve el foco al cancelar.
// Los menús que se cierran al pulsar pasan su propio botón disparador, porque el elemento pulsado deja de existir.
// `dialogoCierreSesion` se pinta FUERA del cajón móvil y de las zonas `inert` (por eso cada layout lo coloca aparte);
// `cierreAbierto` permite pausar la trampa de foco del cajón mientras el diálogo está abierto.
export const useConfirmarCierreSesion = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const disparadorRef = useRef(null)

  const pedirCierreSesion = (origen) => {
    disparadorRef.current = origen?.currentTarget ?? origen ?? document.activeElement
    setAbierto(true)
  }

  // Tras cancelar, el foco vuelve al control que abrió el diálogo (se ejecuta después de las limpiezas del Modal y del cajón).
  useEffect(() => {
    if (abierto) return
    disparadorRef.current?.focus?.()
    disparadorRef.current = null
  }, [abierto])

  const cancelar = () => setAbierto(false)

  const confirmar = () => {
    disparadorRef.current = null
    setAbierto(false)
    logout()
    navigate('/acceso')
  }

  const dialogoCierreSesion = abierto && (
    <ModalConfirmar
      titulo="¿Cerrar sesión?"
      texto="Tendrás que volver a iniciar sesión para entrar al panel."
      textoConfirmar="Cerrar sesión"
      alConfirmar={confirmar}
      alCerrar={cancelar}
      focoEnCancelar
    />
  )

  return { pedirCierreSesion, dialogoCierreSesion, cierreAbierto: abierto }
}
