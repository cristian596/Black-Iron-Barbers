import { useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import Campo, { ESTILO_CAMPO } from './CampoFormulario'

// Contraseña con botón para mostrarla u ocultarla (44 px de alto, como el resto de controles táctiles).
const CampoContrasena = ({ id, etiqueta, valor, alCambiar, error, ayuda, autoComplete = 'new-password' }) => {
  const [visible, setVisible] = useState(false)
  return (
    <Campo id={id} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <div className="flex min-w-0 items-center gap-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={valor}
          onChange={alCambiar}
          className={`${ESTILO_CAMPO} ${error ? 'border-red-500' : 'border-white/15'}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/15 text-zinc-300 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
        >
          {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
        </button>
      </div>
    </Campo>
  )
}

export default CampoContrasena
