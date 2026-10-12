import { useState } from 'react'
import { FiChevronDown, FiEdit2 } from 'react-icons/fi'
import InterruptorActivo from './InterruptorActivo'
import ModalConfirmar from './ModalConfirmar'
import { interpretarError } from '../../utils/erroresCatalogo'

const CAMPO =
  'min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro'
const BOTON_SECUNDARIO =
  'min-h-11 cursor-pointer rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro'
const BOTON_PRIMARIO =
  'min-h-11 cursor-pointer rounded-lg bg-oro px-4 text-sm font-semibold text-black hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50'

const leerOrden = (texto) => {
  const limpio = texto.trim()
  if (limpio === '') return { vacio: true }
  if (!/^\d{1,6}$/.test(limpio) || Number(limpio) > 100000) return { error: 'El orden debe ser un número entero entre 0 y 100000.' }
  return { valor: Number(limpio) }
}

// Formulario compartido para crear y renombrar. `categoria` null = alta (el orden es opcional: va al final).
const FormularioCategoria = ({ categoria, alGuardar, alCancelar }) => {
  const sufijo = categoria ? `categoria-${categoria.id}` : 'categoria-nueva'
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [orden, setOrden] = useState(categoria ? String(categoria.orden) : '')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    const nuevos = {}
    const nombreLimpio = nombre.trim()
    if (nombreLimpio.length < 1 || nombreLimpio.length > 100) nuevos.nombre = 'El nombre es obligatorio (máximo 100 caracteres).'
    const ordenLeido = leerOrden(orden)
    if (ordenLeido.error) nuevos.orden = ordenLeido.error
    if (categoria && ordenLeido.vacio) nuevos.orden = 'El orden es obligatorio.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return

    const datos = { nombre: nombreLimpio }
    if (!ordenLeido.vacio) datos.orden = ordenLeido.valor
    setGuardando(true)
    try {
      await alGuardar(datos)
      if (!categoria) {
        setNombre('')
        setOrden('')
      }
    } catch (err) {
      const { campo, mensaje } = interpretarError(err, 'categoría')
      setErrores({ [campo ?? 'general']: mensaje })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-start">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${sufijo}-nombre`} className="text-sm font-medium text-zinc-300">{categoria ? 'Nombre' : 'Nueva categoría'}</label>
        <input id={`${sufijo}-nombre`} type="text" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} aria-invalid={errores.nombre ? 'true' : undefined} aria-describedby={errores.nombre ? `${sufijo}-nombre-error` : undefined} />
        {errores.nombre && <p id={`${sufijo}-nombre-error`} role="alert" className="text-sm text-red-400">{errores.nombre}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${sufijo}-orden`} className="text-sm font-medium text-zinc-300">Orden{categoria ? '' : ' (opcional)'}</label>
        <input id={`${sufijo}-orden`} type="text" inputMode="numeric" autoComplete="off" value={orden} onChange={(e) => setOrden(e.target.value)} className={CAMPO} aria-invalid={errores.orden ? 'true' : undefined} aria-describedby={errores.orden ? `${sufijo}-orden-error` : undefined} />
        {errores.orden && <p id={`${sufijo}-orden-error`} role="alert" className="text-sm text-red-400">{errores.orden}</p>}
      </div>
      <div className="flex gap-2 sm:mt-6">
        <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>{guardando ? 'Guardando...' : categoria ? 'Guardar' : 'Crear categoría'}</button>
        {alCancelar && <button type="button" onClick={alCancelar} className={BOTON_SECUNDARIO}>Cancelar</button>}
      </div>
      {errores.general && <p role="alert" className="text-sm text-red-400 sm:col-span-3">{errores.general}</p>}
    </form>
  )
}

// Sección plegable: crear, renombrar, ordenar y activar o desactivar categorías. El identificador (slug) se genera
// al crear y no se puede editar. Sin borrar: una categoría con servicios activos no se puede desactivar.
const SeccionCategorias = ({ categorias, alCrear, alActualizar }) => {
  const [abierta, setAbierta] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [porDesactivar, setPorDesactivar] = useState(null)
  const [errorConfirmar, setErrorConfirmar] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)
  const [aviso, setAviso] = useState('')
  const [errorSeccion, setErrorSeccion] = useState('')

  const activar = async (categoria) => {
    setErrorSeccion('')
    setAviso('')
    setGuardandoId(categoria.id)
    try {
      await alActualizar(categoria.id, { activo: true })
      setAviso(`Categoría «${categoria.nombre}» activada.`)
    } catch (err) {
      setErrorSeccion(interpretarError(err, 'categoría').mensaje)
    } finally {
      setGuardandoId(null)
    }
  }

  const confirmarDesactivar = async () => {
    setErrorConfirmar('')
    setGuardandoId(porDesactivar.id)
    try {
      await alActualizar(porDesactivar.id, { activo: false })
      setAviso(`Categoría «${porDesactivar.nombre}» desactivada.`)
      setPorDesactivar(null)
    } catch (err) {
      setErrorConfirmar(interpretarError(err, 'categoría').mensaje)
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <section aria-labelledby="titulo-categorias" className="min-w-0 rounded-xl border border-white/10 bg-zinc-950">
      <h2 id="titulo-categorias" className="text-lg font-semibold">
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls="panel-categorias"
          onClick={() => setAbierta((v) => !v)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-4 text-left focus-visible:outline-2 focus-visible:outline-oro"
        >
          <span>Categorías <span className="text-sm font-normal text-zinc-400">({categorias.length})</span></span>
          <FiChevronDown aria-hidden="true" className={`shrink-0 motion-safe:transition-transform motion-safe:duration-200 ${abierta ? 'rotate-180' : ''}`} />
        </button>
      </h2>

      {abierta && (
        <div id="panel-categorias" className="flex min-w-0 flex-col gap-5 border-t border-white/10 p-4">
          <FormularioCategoria alGuardar={async (datos) => { setAviso(''); await alCrear(datos); setAviso(`Categoría «${datos.nombre}» creada.`) }} />

          {aviso && <p role="status" className="text-sm text-emerald-400">{aviso}</p>}
          {errorSeccion && <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{errorSeccion}</p>}

          {categorias.length === 0 ? (
            <p className="text-sm text-zinc-400">Todavía no hay categorías.</p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-3">
              {categorias.map((categoria) => (
                <li key={categoria.id} className={`min-w-0 rounded-lg border border-white/10 p-3 ${categoria.activo ? '' : 'opacity-60'}`}>
                  {editandoId === categoria.id ? (
                    <FormularioCategoria
                      categoria={categoria}
                      alCancelar={() => setEditandoId(null)}
                      alGuardar={async (datos) => {
                        setAviso('')
                        await alActualizar(categoria.id, datos)
                        setEditandoId(null)
                        setAviso(`Categoría «${datos.nombre}» actualizada.`)
                      }}
                    />
                  ) : (
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-medium">
                          {categoria.nombre}
                          {!categoria.activo && <span className="ml-2 rounded-full border border-zinc-600 px-2 py-0.5 text-xs font-medium text-zinc-400">Inactiva</span>}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Identificador: {categoria.slug} · Orden {categoria.orden} · {categoria.total_servicios} activo(s), {categoria.total_inactivos} inactivo(s)
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <InterruptorActivo
                          activo={categoria.activo}
                          etiqueta={`${categoria.activo ? 'Desactivar' : 'Activar'} la categoría ${categoria.nombre}`}
                          deshabilitado={guardandoId === categoria.id}
                          alCambiar={() => (categoria.activo ? (setErrorConfirmar(''), setPorDesactivar(categoria)) : activar(categoria))}
                        />
                        <button type="button" onClick={() => setEditandoId(categoria.id)} aria-label={`Editar la categoría ${categoria.nombre}`} className={`${BOTON_SECUNDARIO} inline-flex items-center gap-2`}>
                          <FiEdit2 aria-hidden="true" /> Editar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {porDesactivar && (
        <ModalConfirmar
          titulo={`¿Desactivar la categoría «${porDesactivar.nombre}»?`}
          texto="Dejará de mostrarse en el catálogo y en la reserva. Si tiene servicios activos no se puede desactivar. Nada se borra."
          textoConfirmar="Desactivar"
          cargando={guardandoId === porDesactivar.id}
          error={errorConfirmar}
          alConfirmar={confirmarDesactivar}
          alCerrar={() => setPorDesactivar(null)}
        />
      )}
    </section>
  )
}

export default SeccionCategorias
