import { useRef } from 'react'
import { FiX } from 'react-icons/fi'
import { useAtraparFoco } from '../../hooks/useAtraparFoco'
import FormularioServicio from './FormularioServicio'

const BOTON_CERRAR =
  'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-oro'

const Cabecera = ({ idTitulo, titulo, alCerrar }) => (
  <div className="mb-4 flex items-center justify-between gap-2">
    <h2 id={idTitulo} className="min-w-0 text-lg font-semibold">{titulo}</h2>
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
      aria-labelledby="titulo-panel-servicio"
      className="fixed inset-0 z-50 min-w-0 overflow-y-auto bg-black px-4 py-4 text-white"
    >
      <div className="mx-auto w-full min-w-0 max-w-xl">
        <Cabecera idTitulo="titulo-panel-servicio" titulo={titulo} alCerrar={alCerrar} />
        {children}
      </div>
    </div>
  )
}

// Escritorio ancho: columna lateral junto a la tabla.
const Lateral = ({ titulo, alCerrar, children }) => (
  <aside
    aria-labelledby="titulo-panel-servicio"
    className="min-w-0 self-start rounded-xl border border-white/10 bg-zinc-950 p-4 xl:sticky xl:top-20"
  >
    <Cabecera idTitulo="titulo-panel-servicio" titulo={titulo} alCerrar={alCerrar} />
    {children}
  </aside>
)

// `servicio` null = alta. La key reinicia el formulario al cambiar de servicio.
const PanelEdicionServicio = ({ lateral, servicio, categorias, alGuardar, alCerrar, errorInicial }) => {
  const Contenedor = lateral ? Lateral : PantallaCompleta
  return (
    <Contenedor titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'} alCerrar={alCerrar}>
      <FormularioServicio
        key={servicio?.id ?? 'nuevo'}
        servicio={servicio}
        categorias={categorias}
        alGuardar={alGuardar}
        alCancelar={alCerrar}
        errorInicial={errorInicial}
      />
    </Contenedor>
  )
}

export default PanelEdicionServicio
