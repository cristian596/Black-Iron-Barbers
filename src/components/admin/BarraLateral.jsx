import { useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { FiScissors, FiLogOut, FiX } from 'react-icons/fi'
import { SECCIONES_ADMIN } from '../../data/menuAdmin'
import { useAtraparFoco } from '../../hooks/useAtraparFoco'

// Escritorio (lg+): columna fija. Móvil: cajón que entra desde la izquierda; mientras está abierto
// actúa como diálogo (foco atrapado, Escape y clic en el fondo lo cierran) y cerrado queda `inert`.
// `secciones`: entradas del menú (data/menuAdmin.js, data/menuBarbero.js). `tarjeta`: bloque opcional bajo el logo.
const BarraLateral = ({ secciones = SECCIONES_ADMIN, tarjeta = null, modal, abierta, alCerrar, alCerrarSesion }) => {
  const ref = useRef(null)
  const comoDialogo = modal && abierta
  useAtraparFoco(ref, comoDialogo, alCerrar)

  return (
    <>
      {comoDialogo && (
        <div aria-hidden="true" onClick={alCerrar} className="fixed inset-0 z-30 bg-black/70 lg:hidden print:hidden" />
      )}
      <aside
        ref={ref}
        id="barra-lateral"
        inert={modal && !abierta}
        role={comoDialogo ? 'dialog' : undefined}
        aria-modal={comoDialogo ? 'true' : undefined}
        aria-label="Menú de navegación"
        className={`fixed inset-y-0 left-0 z-40 print:hidden flex w-72 max-w-[85vw] min-w-0 flex-col border-r border-white/10 bg-[#0a0a0a] motion-safe:transition-transform motion-safe:duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:max-w-none lg:translate-x-0 ${
          abierta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-white/10 px-5">
          <span className="flex min-w-0 items-center gap-2 font-cinzel text-lg font-semibold tracking-wide">
            <FiScissors aria-hidden="true" className="shrink-0 text-oro" />
            <span className="truncate">Black Iron</span>
          </span>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar menú"
            className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-oro lg:hidden"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        {tarjeta}

        <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {secciones.map(({ ruta, etiqueta, icono: Icono, exacta }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  end={exacta}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-3 text-sm font-medium duration-200 focus-visible:outline-2 focus-visible:outline-oro ${
                      isActive
                        ? 'border-oro bg-oro/10 text-oro'
                        : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icono aria-hidden="true" className="shrink-0" />
                  {etiqueta}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={alCerrarSesion}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-300 duration-200 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
          >
            <FiLogOut aria-hidden="true" className="shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}

export default BarraLateral
