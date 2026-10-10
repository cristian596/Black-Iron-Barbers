import { useState } from 'react'
import { cambiarContrasena } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import CampoContrasena from '../admin/CampoContrasena'
import { LIMITES_EMPLEADO } from '../../utils/empleados'

// `variante`: "panel" (por defecto, panel del barbero: botón crema) o "admin" (dashboard del admin: botón dorado).
// `alExito(respuesta)`: se llama tras cambiarla (el back-end devuelve la nueva `vigencia` del barbero).
const BOTON = {
  panel: 'bg-amber-50 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-50',
  admin: 'bg-oro hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro',
}

const { contrasenaMin, contrasenaMax } = LIMITES_EMPLEADO

const CambiarContrasena = ({ token, variante = 'panel', alExito, titulo = 'Cambiar contraseña' }) => {
  const auth = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrores({})
    setError('')
    setMensaje('')

    const nuevos = {}
    if (nueva.length < contrasenaMin || nueva.length > contrasenaMax) {
      nuevos.nueva = `La nueva contraseña debe tener entre ${contrasenaMin} y ${contrasenaMax} caracteres`
    } else if (nueva === actual) {
      nuevos.nueva = 'La nueva contraseña debe ser distinta de la actual'
    }
    if (nueva !== confirmar) nuevos.confirmar = 'La confirmación no coincide con la nueva contraseña'
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      return
    }

    setCargando(true)
    try {
      const respuesta = await cambiarContrasena(token, actual, nueva)
      auth?.renovarToken?.(respuesta?.token) // el servidor invalida los tokens anteriores al cambiar la contraseña
      setMensaje('Contraseña actualizada correctamente')
      setActual('')
      setNueva('')
      setConfirmar('')
      alExito?.(respuesta)
    } catch (err) {
      // El back-end indica el campo (actual / nueva) cuando el error es de un campo; si no, va como aviso general.
      if (err.campo === 'actual' || err.campo === 'nueva') setErrores({ [err.campo]: err.message })
      else setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-contrasena" className="min-w-0 max-w-md">
      <h2 id="titulo-contrasena" className="mb-3 text-2xl font-semibold">
        {titulo}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <CampoContrasena
          id="actual"
          etiqueta="Contraseña actual"
          valor={actual}
          alCambiar={(e) => setActual(e.target.value)}
          error={errores.actual}
          autoComplete="current-password"
        />
        <CampoContrasena
          id="nueva"
          etiqueta="Nueva contraseña"
          ayuda={`Entre ${contrasenaMin} y ${contrasenaMax} caracteres`}
          valor={nueva}
          alCambiar={(e) => setNueva(e.target.value)}
          error={errores.nueva}
        />
        <CampoContrasena
          id="confirmar"
          etiqueta="Confirmar nueva contraseña"
          valor={confirmar}
          alCambiar={(e) => setConfirmar(e.target.value)}
          error={errores.confirmar}
        />

        {error && (
          <p className="text-red-400" role="alert">
            {error}
          </p>
        )}
        <p className="text-green-400" role="status">
          {mensaje}
        </p>

        <button
          type="submit"
          disabled={cargando}
          className={`min-h-11 w-fit cursor-pointer rounded-xl px-4 font-medium text-black duration-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${BOTON[variante]}`}
        >
          {cargando ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </section>
  )
}

export default CambiarContrasena
