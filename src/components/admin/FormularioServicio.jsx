import { useRef, useState } from 'react'
import { TIPOS_SERVICIO } from '../../data/tiposServicio'
import { interpretarError, validarFormularioServicio } from '../../utils/erroresCatalogo'

const CAMPO =
  'min-h-11 w-full min-w-0 rounded-lg border bg-black px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-oro'
const MAX_DESCRIPCION = 500

const valoresIniciales = (servicio) => ({
  nombre: servicio?.nombre ?? '',
  categoria_id: servicio?.categoria?.id ? String(servicio.categoria.id) : '',
  tipo: servicio?.tipo ?? '',
  precio: servicio ? String(servicio.precio) : '',
  duracion_min: servicio ? String(servicio.duracion_min) : '',
  descripcion: servicio?.descripcion ?? '',
})

const Campo = ({ id, etiqueta, error, ayuda, children }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <label htmlFor={id} className="text-sm font-medium text-zinc-300">{etiqueta}</label>
    {children}
    {ayuda && !error && <p id={`${id}-ayuda`} className="text-xs text-zinc-500">{ayuda}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-400">{error}</p>}
  </div>
)

// Alta y edición de un servicio. `servicio` null = alta. `alGuardar(datos)` devuelve una promesa; si falla con un
// error de la API, el mensaje se muestra en el campo que indica su código (o arriba si no es de un campo).
const FormularioServicio = ({ servicio, categorias, alGuardar, alCancelar, errorInicial = '' }) => {
  const [valores, setValores] = useState(() => valoresIniciales(servicio))
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(errorInicial)
  const [guardando, setGuardando] = useState(false)
  const formularioRef = useRef(null)

  const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }))
  const estilo = (campo) => `${CAMPO} ${errores[campo] ? 'border-red-500' : 'border-white/15'}`
  const accesibilidad = (campo, ayuda = false) => ({
    'aria-invalid': errores[campo] ? 'true' : undefined,
    'aria-describedby': errores[campo] ? `servicio-${campo}-error` : ayuda ? `servicio-${campo}-ayuda` : undefined,
  })

  const enfocarPrimerError = (lista) => {
    const primero = ['nombre', 'categoria_id', 'tipo', 'precio', 'duracion_min', 'descripcion'].find((c) => lista[c])
    if (primero) formularioRef.current?.querySelector(`#servicio-${primero}`)?.focus()
  }

  const enviar = async (e) => {
    e.preventDefault()
    setErrorGeneral('')
    const { errores: nuevos, datos } = validarFormularioServicio(valores)
    setErrores(nuevos)
    if (!datos) {
      enfocarPrimerError(nuevos)
      return
    }

    setGuardando(true)
    try {
      await alGuardar(datos)
    } catch (err) {
      const { campo, mensaje } = interpretarError(err, 'servicio')
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

  const categoriasUtilizables = categorias.filter((c) => c.activo || String(c.id) === valores.categoria_id)

  return (
    <form ref={formularioRef} onSubmit={enviar} noValidate className="flex min-w-0 flex-col gap-4">
      {errorGeneral && (
        <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{errorGeneral}</p>
      )}

      <Campo id="servicio-nombre" etiqueta="Nombre" error={errores.nombre}>
        <input id="servicio-nombre" type="text" maxLength={150} value={valores.nombre} onChange={cambiar('nombre')} className={estilo('nombre')} {...accesibilidad('nombre')} />
      </Campo>

      <Campo id="servicio-categoria_id" etiqueta="Categoría" error={errores.categoria_id}>
        <select id="servicio-categoria_id" value={valores.categoria_id} onChange={cambiar('categoria_id')} className={estilo('categoria_id')} {...accesibilidad('categoria_id')}>
          <option value="">Selecciona una categoría</option>
          {categoriasUtilizables.map((c) => (
            <option key={c.id} value={c.id} disabled={!c.activo}>
              {c.nombre}{c.activo ? '' : ' (inactiva)'}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="servicio-tipo" etiqueta="Tipo" error={errores.tipo}>
        <select id="servicio-tipo" value={valores.tipo} onChange={cambiar('tipo')} className={estilo('tipo')} {...accesibilidad('tipo')}>
          <option value="">Selecciona el tipo</option>
          {TIPOS_SERVICIO.map(({ valor, etiqueta }) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="servicio-precio" etiqueta="Precio (COP)" error={errores.precio} ayuda="0 se muestra como «Gratis».">
          <input id="servicio-precio" type="text" inputMode="numeric" autoComplete="off" value={valores.precio} onChange={cambiar('precio')} className={estilo('precio')} {...accesibilidad('precio', true)} />
        </Campo>
        <Campo id="servicio-duracion_min" etiqueta="Duración (minutos)" error={errores.duracion_min} ayuda="Entre 1 y 600.">
          <input id="servicio-duracion_min" type="text" inputMode="numeric" autoComplete="off" value={valores.duracion_min} onChange={cambiar('duracion_min')} className={estilo('duracion_min')} {...accesibilidad('duracion_min', true)} />
        </Campo>
      </div>

      <Campo id="servicio-descripcion" etiqueta="Descripción" error={errores.descripcion}>
        <textarea
          id="servicio-descripcion"
          rows={4}
          maxLength={MAX_DESCRIPCION}
          value={valores.descripcion}
          onChange={cambiar('descripcion')}
          className={`${estilo('descripcion')} py-2`}
          {...accesibilidad('descripcion')}
        />
        <p className="text-right text-xs text-zinc-500" aria-live="off">{valores.descripcion.length}/{MAX_DESCRIPCION}</p>
      </Campo>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={alCancelar}
          className="min-h-11 cursor-pointer rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-oro"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="min-h-11 cursor-pointer rounded-lg bg-oro px-5 text-sm font-semibold text-black hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : servicio ? 'Guardar cambios' : 'Crear servicio'}
        </button>
      </div>
    </form>
  )
}

export default FormularioServicio
