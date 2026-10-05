import { useState } from 'react'
import { FiAlertTriangle } from 'react-icons/fi'
import CambiarContrasena from './CambiarContrasena'
import { textoDias } from '../../utils/vigencia'

// Aviso del panel del barbero cuando su contraseña está por vencer. El formulario de cambio solo existe aquí
// (y en la pantalla obligatoria): fuera de esta ventana el back-end responde 403 CAMBIO_NO_PERMITIDO.
const AvisoCaducidad = ({ vigencia, token, alCambiada }) => {
  const [abierto, setAbierto] = useState(false)

  return (
    <section aria-labelledby="titulo-aviso-caducidad" className="min-w-0 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
      <div role="status" className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p id="titulo-aviso-caducidad" className="flex min-w-0 items-start gap-2 text-amber-200">
          <FiAlertTriangle aria-hidden="true" className="mt-1 shrink-0" />
          <span className="wrap-anywhere">
            <strong className="font-semibold">Tu contraseña caduca en {textoDias(vigencia.dias_restantes)}.</strong> Cámbiala ahora.
          </span>
        </p>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-expanded={abierto}
            aria-controls="formulario-caducidad"
            className="min-h-11 w-full shrink-0 cursor-pointer rounded-xl bg-amber-50 px-4 font-medium text-black duration-300 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-50 active:scale-95 sm:w-auto"
          >
            Cambiar contraseña
          </button>
        )}
      </div>
      {abierto && (
        <div id="formulario-caducidad" className="mt-4 border-t border-amber-500/30 pt-4">
          <CambiarContrasena token={token} alExito={alCambiada} />
        </div>
      )}
    </section>
  )
}

export default AvisoCaducidad
