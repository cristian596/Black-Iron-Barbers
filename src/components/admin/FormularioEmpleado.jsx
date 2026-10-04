import { useRef, useState } from 'react'
import { LIMITES_EMPLEADO, interpretarErrorEmpleado, validarFormularioEmpleado } from '../../utils/empleados'
import Campo, { ESTILO_CAMPO } from './CampoFormulario'
import CampoContrasena from './CampoContrasena'

const ORDEN_CAMPOS = ['nombre', 'cargo', 'especialidad', 'usuario', 'contrasena']

const valoresIniciales = (empleado) => ({
  nombre: empleado?.nombre ?? '',
  cargo: empleado?.cargo ?? '',
  especialidad: empleado?.especialidad ?? '',
  usuario: '',
  contrasena: '',
})

// Alta (`empleado` null: pide también usuario y contraseña) y edición (nombre, cargo y especialidad).
// `alGuardar(datos)` devuelve una promesa; si falla, el error se muestra en el campo que indica su código.
const FormularioEmpleado = ({ empleado, alGuardar, alCancelar }) => {
  const creando = !empleado
  const [valores, setValores] = useState(() => valoresIniciales(empleado))
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)
  const formularioRef = useRef(null)

  const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }))
  const estilo = (campo) => `${ESTILO_CAMPO} ${errores[campo] ? 'border-red-500' : 'border-white/15'}`
  const accesibilidad = (campo, ayuda = false) => ({
    'aria-invalid': errores[campo] ? 'true' : undefined,
    'aria-describedby': errores[campo] ? `empleado-${campo}-error` : ayuda ? `empleado-${campo}-ayuda` : undefined,
  })

  const enfocarPrimerError = (lista) => {
    const primero = ORDEN_CAMPOS.find((c) => lista[c])
    if (primero) formularioRef.current?.querySelector(`#empleado-${primero}`)?.focus()
  }

  const enviar = async (e) => {
    e.preventDefault()
    setErrorGeneral('')
    const { errores: nuevos, datos } = validarFormularioEmpleado(valores, { conAcceso: creando })
    setErrores(nuevos)
    if (!datos) {
      enfocarPrimerError(nuevos)
      return
    }

    setGuardando(true)
    try {
      await alGuardar(datos)
    } catch (err) {
      const { campo, mensaje } = interpretarErrorEmpleado(err)
      if (campo && campo in valores) {
        const conError = { [campo]: mensaje }
        setErrores(conError)
        enfocarPrimerError(conError)
      } else {
        setErrorGeneral(mensaje)
      }
      setGuardando(false)
    }
  }

  return (
    <form ref={formularioRef} onSubmit={enviar} noValidate className="flex min-w-0 flex-col gap-4">
      {errorGeneral && <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{errorGeneral}</p>}

      <Campo id="empleado-nombre" etiqueta="Nombre" error={errores.nombre}>
        <input id="empleado-nombre" type="text" maxLength={LIMITES_EMPLEADO.nombre} value={valores.nombre} onChange={cambiar('nombre')} className={estilo('nombre')} {...accesibilidad('nombre')} />
      </Campo>
      <Campo id="empleado-cargo" etiqueta="Cargo (opcional)" error={errores.cargo}>
        <input id="empleado-cargo" type="text" maxLength={LIMITES_EMPLEADO.cargo} value={valores.cargo} onChange={cambiar('cargo')} placeholder="Barbero Profesional" className={estilo('cargo')} {...accesibilidad('cargo')} />
      </Campo>
      <Campo id="empleado-especialidad" etiqueta="Especialidad (opcional)" error={errores.especialidad}>
        <input id="empleado-especialidad" type="text" maxLength={LIMITES_EMPLEADO.especialidad} value={valores.especialidad} onChange={cambiar('especialidad')} placeholder="Fade y barba" className={estilo('especialidad')} {...accesibilidad('especialidad')} />
      </Campo>

      {creando && (
        <>
          <Campo id="empleado-usuario" etiqueta="Usuario de acceso" error={errores.usuario} ayuda="Con él iniciará sesión en /acceso.">
            <input id="empleado-usuario" type="text" autoComplete="off" autoCapitalize="none" maxLength={LIMITES_EMPLEADO.usuario} value={valores.usuario} onChange={cambiar('usuario')} className={estilo('usuario')} {...accesibilidad('usuario', true)} />
          </Campo>
          <CampoContrasena
            id="empleado-contrasena"
            etiqueta="Contraseña"
            valor={valores.contrasena}
            alCambiar={cambiar('contrasena')}
            error={errores.contrasena}
            ayuda={`Entre ${LIMITES_EMPLEADO.contrasenaMin} y ${LIMITES_EMPLEADO.contrasenaMax} caracteres.`}
          />
        </>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={alCancelar} className="min-h-11 cursor-pointer rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-oro">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="min-h-11 cursor-pointer rounded-lg bg-oro px-5 text-sm font-semibold text-black hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50">
          {guardando ? 'Guardando...' : creando ? 'Crear empleado' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

export default FormularioEmpleado
