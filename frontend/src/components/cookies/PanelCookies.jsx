import Modal from '../ui/Modal'
import { useConsentimiento } from '../../hooks/useConsentimiento'
import { cerrarPanelCookies } from '../../utils/consentimiento'
import OpcionesCookies from './OpcionesCookies'

// Diálogo de configuración de cookies (se abre desde el banner y desde el pie). Va por encima del banner y de las barras
// fijas; foco atrapado, Escape y clic en el fondo lo cierran y el foco vuelve a quien lo abrió (Modal).
const PanelCookies = () => {
  const { panelAbierto } = useConsentimiento()
  if (!panelAbierto) return null

  return (
    <Modal idTitulo="titulo-panel-cookies" alCerrar={cerrarPanelCookies} capa="z-[80]" claseCaja="max-w-xl">
      <h2 id="titulo-panel-cookies" className="pr-12 font-cinzel text-2xl font-bold">
        Configuración de cookies
      </h2>
      <p className="mt-2 mb-4 font-poppins text-sm text-zinc-300">
        Elige qué cookies aceptas. Puedes cambiar tu decisión cuando quieras desde el pie de página.
      </p>
      <OpcionesCookies idBase="panel-cookies" alTerminar={cerrarPanelCookies} />
    </Modal>
  )
}

export default PanelCookies
