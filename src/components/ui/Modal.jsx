import { useRef } from 'react'
import { FiX } from 'react-icons/fi'
import { useAtraparFoco } from '../../hooks/useAtraparFoco'

// Diálogo modal accesible: foco atrapado, Escape y clic en el fondo lo cierran.
// `idTitulo` es el id del encabezado que lo nombra (aria-labelledby).
const Modal = ({ idTitulo, alCerrar, children }) => {
  const ref = useRef(null)
  useAtraparFoco(ref, true, alCerrar)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start overflow-y-auto bg-black/80 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative mx-auto w-full min-w-0 max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 text-white"
      >
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex size-11 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
        >
          <FiX aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  )
}

export default Modal
