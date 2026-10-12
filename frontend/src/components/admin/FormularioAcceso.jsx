import { useRef, useState } from 'react'
import { LIMITES_EMPLEADO, interpretarErrorEmpleado, validarFormularioAcceso } from '../../utils/empleados'
import Campo, { ESTILO_CAMPO } from './CampoFormulario'
import CampoContrasena from './CampoContrasena'

// Acceso de un empleado: con `empleado.usuario` restablece su contraseña; sin usuario crea el acceso (usuario y
// contraseña). `alGuardar(datos)` devuelve una promesa; un error de la API se muestra en el campo que indica su código.
const FormularioAcceso = ({ empleado, alGuardar, alCancelar }) => {
  const creando = !empleado.usuario
  const [valores, setValores] = useState({ usuario: '', contrasena: '' })
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)
  const formularioRef = useRef(null)

  const enfocarPrimerError = (lista) => {
    const primero = ['usuario', 'contrasena'].find((c) => lista[c])
    if (primero) formularioRef.current?.querySelector(`#acceso-${primero}`)?.focus()
  }

  const enviar = async (e) => {
    e.preventDefault()
    setErrorGeneral('')
    const { errores: nuevos, datos } = validarFormularioAcceso(valores, { creando })
    setErrores(nuevos)
    if (!datos) {
      enfocarPrimerError(nuevos)
      return
    }
    setGuardando(true)
    try {
      await alGuardar({ usuario: valores.usuario.trim(), contrasena: valores.contrasena })
    } catch (err) {
      const { campo, mensaje } = interpretarErrorEmpleado(err)
      if (campo && campo in valores) {
        setErrores({ [campo]: mensaje })
        enfocarPrimerError({ [campo]: mensaje })
      } else {
        setErrorGeneral(mensaje)
      }
      setGuardando(false)
    }
  }

  return (
    <form ref={formularioRef} onSubmit={enviar} noValidate className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-zinc-300">
        {creando
          ? `${empleado.nombre} todavía no tiene acceso al panel. Crea su usuario y contraseña.`
          : `Define una contraseña nueva para el usuario «${empleado.usuario.usuario}» de ${empleado.nombre}. La actual dejará de servir.`}
        {` La contraseña vale 60 días desde este momento.`}
      </p>
      {errorGeneral && <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{errorGeneral}</p>}

      {creando && (
        <Campo id="acceso-usuario" etiqueta="Usuario de acceso" error={errores.usuario}>
          <input
            id="acceso-usuario"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            maxLength={LIMITES_EMPLEADO.usuario}
            value={valores.usuario}
            onChange={(e) => setValores((v) => ({ ...v, usuario: e.target.value }))}
            className={`${ESTILO_CAMPO} ${errores.usuario ? 'border-red-500' : 'border-white/15'}`}
            aria-invalid={errores.usuario ? 'true' : undefined}
            aria-describedby={errores.usuario ? 'acceso-usuario-error' : undefined}
          />
        </Campo>
      )}
      <CampoContrasena
        id="acceso-contrasena"
        etiqueta="Contraseña nueva"
        valor={valores.contrasena}
        alCambiar={(e) => setValores((v) => ({ ...v, contrasena: e.target.value }))}
        error={errores.contrasena}
        ayuda={`Entre ${LIMITES_EMPLEADO.contrasenaMin} y ${LIMITES_EMPLEADO.contrasenaMax} caracteres.`}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={alCancelar} className="min-h-11 cursor-pointer rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-oro">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="min-h-11 cursor-pointer rounded-lg bg-oro px-5 text-sm font-semibold text-black hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50">
          {guardando ? 'Guardando...' : creando ? 'Crear acceso' : 'Guardar contraseña'}
        </button>
      </div>
    </form>
  )
}

export default FormularioAcceso
