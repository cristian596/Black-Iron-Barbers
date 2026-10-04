import { useState } from 'react'
import { cambiarContrasena } from '../../services/api'

// `variante`: "panel" (por defecto, panel del barbero: botón crema) o "admin" (dashboard del admin: botón dorado).
const BOTON = {
  panel: 'bg-amber-50 hover:bg-amber-200',
  admin: 'bg-oro hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro',
}

const CambiarContrasena = ({ token, variante = 'panel' }) => {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña')
      return
    }

    setCargando(true)
    try {
      await cambiarContrasena(token, actual, nueva)
      setMensaje('Contraseña actualizada correctamente')
      setActual('')
      setNueva('')
      setConfirmar('')
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-contrasena" className="max-w-md">
      <h2 id="titulo-contrasena" className="mb-3 text-2xl font-semibold">
        Cambiar contraseña
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="actual" className="text-sm font-medium text-gray-300">
            Contraseña actual
          </label>
          <input
            id="actual"
            name="actual"
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="nueva" className="text-sm font-medium text-gray-300">
            Nueva contraseña (mínimo 8 caracteres)
          </label>
          <input
            id="nueva"
            name="nueva"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            minLength={8}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirmar" className="text-sm font-medium text-gray-300">
            Confirmar nueva contraseña
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            minLength={8}
            required
          />
        </div>

        {error && (
          <p className="text-red-400" role="alert">
            {error}
          </p>
        )}
        {mensaje && <p className="text-green-400">{mensaje}</p>}

        <button
          type="submit"
          disabled={cargando}
          className={`mt-2 w-fit cursor-pointer rounded-xl p-2 px-4 font-medium text-black duration-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${BOTON[variante]}`}
        >
          {cargando ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </section>
  )
}

export default CambiarContrasena
