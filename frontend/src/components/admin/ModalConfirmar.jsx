import { useEffect, useRef } from 'react'
import Modal from '../ui/Modal'

// Confirmación con el Modal del panel (foco atrapado, Escape y clic en el fondo cierran). Muestra el error de la
// acción dentro del mismo diálogo para poder reintentar o cancelar.
// `children` admite contenido extra bajo el texto (por ejemplo un enlace).
// `focoEnCancelar`: el foco inicial va a "Cancelar" (por defecto, al primer control del Modal).
const ModalConfirmar = ({ titulo, texto, textoConfirmar, alConfirmar, alCerrar, cargando = false, error = '', focoEnCancelar = false, children }) => {
  const cancelarRef = useRef(null)
  // Corre después del efecto del Modal (que enfoca su primer control), así que este foco es el que queda.
  useEffect(() => {
    if (focoEnCancelar) cancelarRef.current?.focus()
  }, [focoEnCancelar])

  return (
    <Modal idTitulo="titulo-confirmar" alCerrar={alCerrar}>
      <h2 id="titulo-confirmar" className="pr-10 text-xl font-semibold">{titulo}</h2>
      <p className="mt-2 text-sm text-zinc-300">{texto}</p>
      {children}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}</p>
      )}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          ref={cancelarRef}
          type="button"
          onClick={alCerrar}
          className="min-h-11 cursor-pointer rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-oro"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={cargando}
          onClick={alConfirmar}
          className="min-h-11 cursor-pointer rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? 'Guardando...' : textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}

export default ModalConfirmar
