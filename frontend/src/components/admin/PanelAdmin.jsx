import { useRef } from 'react'
import { FiX } from 'react-icons/fi'
import { useAtraparFoco } from '../../hooks/useAtraparFoco'

const ID_TITULO = 'titulo-panel-admin'
const BOTON_CERRAR =
  'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-oro'

const Cabecera = ({ titulo, alCerrar }) => (
  <div className="mb-4 flex items-center justify-between gap-2">
    <h2 id={ID_TITULO} className="min-w-0 text-lg font-semibold">{titulo}</h2>
    <button type="button" onClick={alCerrar} aria-label="Cerrar" className={BOTON_CERRAR}>
      <FiX aria-hidden="true" />
    </button>
  </div>
)

// Pantalla completa (móvil/tablet): diálogo modal con foco atrapado y Escape.
const PantallaCompleta = ({ titulo, alCerrar, children }) => {
  const ref = useRef(null)
  useAtraparFoco(ref, true, alCerrar)
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ID_TITULO}
      className="fixed inset-0 z-50 min-w-0 overflow-y-auto bg-black px-4 py-4 text-white"
    >
      <div className="mx-auto w-full min-w-0 max-w-xl">
        <Cabecera titulo={titulo} alCerrar={alCerrar} />
        {children}
      </div>
    </div>
  )
}

// Escritorio ancho: columna lateral junto a la tabla.
const Lateral = ({ titulo, alCerrar, children }) => (
  <aside
    aria-labelledby={ID_TITULO}
    className="min-w-0 self-start rounded-xl border border-white/10 bg-zinc-950 p-4 xl:sticky xl:top-20"
  >
    <Cabecera titulo={titulo} alCerrar={alCerrar} />
    {children}
  </aside>
)

// Panel de edición compartido por Servicios y Empleados: lateral en escritorio, pantalla completa en el resto.
const PanelAdmin = ({ lateral, titulo, alCerrar, children }) => {
  const Contenedor = lateral ? Lateral : PantallaCompleta
  return <Contenedor titulo={titulo} alCerrar={alCerrar}>{children}</Contenedor>
}

export default PanelAdmin
