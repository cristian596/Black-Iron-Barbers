import { useEffect, useState } from 'react'
import { HiOutlineSparkles } from 'react-icons/hi2'

const CLAVE_PULSO = 'pulso-cliente-nuevo'
const DURACION_PULSO_MS = 3000

// Marca de sesión (sessionStorage con try/catch: sin storage el pulso simplemente se repite).
const pulsoYaVisto = () => {
  try {
    return sessionStorage.getItem(CLAVE_PULSO) === '1'
  } catch {
    return false
  }
}

const marcarPulsoVisto = () => {
  try {
    sessionStorage.setItem(CLAVE_PULSO, '1')
  } catch {
    // sin storage: no pasa nada
  }
}

// Botón "Soy cliente nuevo": abre el modal de asesorías. `conPulso` añade un anillo que late ~3 s,
// una sola vez por sesión y solo con motion-safe.
const BotonClienteNuevo = ({ onClick, ref, conPulso = false, className = '' }) => {
  const [pulsando, setPulsando] = useState(() => conPulso && !pulsoYaVisto())

  useEffect(() => {
    if (!pulsando) return undefined
    marcarPulsoVisto()
    const id = setTimeout(() => setPulsando(false), DURACION_PULSO_MS)
    return () => clearTimeout(id)
  }, [pulsando])

  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      onClick={(e) => {
        setPulsando(false)
        onClick(e)
      }}
      className={`relative cursor-pointer items-center gap-2 rounded-full border border-oro/60 bg-oro/10 font-poppins font-semibold text-oro duration-300 hover:bg-oro hover:text-black active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oro motion-reduce:transition-none ${className}`}
    >
      {pulsando && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden rounded-full border border-oro motion-safe:block motion-safe:animate-ping"
        />
      )}
      <HiOutlineSparkles aria-hidden="true" className="shrink-0" />
      Soy cliente nuevo
    </button>
  )
}

export default BotonClienteNuevo
