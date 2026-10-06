import { Link } from 'react-router-dom'
import { FiUserCheck } from 'react-icons/fi'
import { textoCambiosPerfil } from '../../utils/perfil'

export const RUTA_CAMBIOS_PERFIL = '/admin/configuracion#cambios-perfil'

// Aviso fijo y NO cerrable del admin: está mientras algún barbero tenga cambios de foto o nombre de perfil sin revisar
// (conteo de /api/admin/cambios-perfil) y se va solo cuando llega a 0. Mismo estilo y lógica que AvisoPorConfirmar del
// panel del barbero: escritorio, tarjeta en la esquina inferior derecha; móvil, franja inferior. Está por debajo del
// cajón y de los modales (z-20). Región `status` con aria-live "polite": el texto solo cambia (y por tanto solo se
// anuncia) cuando cambia el número, no en cada refresco.
const AvisoCambiosPerfil = ({ cantidad }) => {
  if (!(cantidad > 0)) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 print:hidden lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-80">
      <div className="flex min-w-0 flex-col gap-2 border-t border-oro/50 bg-[#0a0a0a] p-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:flex-col lg:items-stretch lg:gap-3 lg:rounded-xl lg:border lg:p-4">
        <p role="status" aria-live="polite" aria-atomic="true" className="flex min-w-0 items-start gap-2 text-sm font-medium text-zinc-100">
          <FiUserCheck aria-hidden="true" className="mt-0.5 shrink-0 text-lg text-oro" />
          <span className="wrap-anywhere">{textoCambiosPerfil(cantidad)}</span>
        </p>
        <Link
          to={RUTA_CAMBIOS_PERFIL}
          className="flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-oro px-4 text-sm font-semibold text-black duration-200 hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
        >
          Revisar ahora
        </Link>
      </div>
    </div>
  )
}

export default AvisoCambiosPerfil
