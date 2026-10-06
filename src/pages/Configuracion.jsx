import { useEffect, useRef, useState } from 'react'
import { FiCamera, FiInfo, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { usePerfil } from '../context/PerfilContext'
import { actualizarPerfil, quitarFotoPerfil, subirFotoPerfil } from '../services/api'
import { LIMITES_PERFIL, TIPOS_FOTO, mensajeErrorPerfil, resolverUrlFoto, validarFoto, validarNombrePerfil } from '../utils/perfil'
import AvatarBarbero from '../components/ui/AvatarBarbero'
import ErrorCarga from '../components/ui/ErrorCarga'
import CampoFormulario, { ESTILO_CAMPO } from '../components/admin/CampoFormulario'

const BOTON_PRIMARIO =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-oro px-5 font-medium text-black duration-300 hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
const BOTON_SECUNDARIO =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 px-5 font-medium text-white duration-300 hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
const TARJETA = 'min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 sm:p-6'

// Configuración del perfil del dashboard, compartida por /panel/configuracion y /admin/configuracion: foto y nombre de
// perfil, que SOLO existen dentro del panel (no cambian lo que ve el cliente en la web). El usuario de acceso no se edita.
const Configuracion = () => {
  const { token, usuario } = useAuth()
  const { perfil, cargando, error, recargar, aplicar, nombrePublico } = usePerfil()
  const esAdmin = usuario.rol === 'admin'

  // Foto: archivo elegido (aún sin guardar) y su vista previa.
  const [seleccion, setSeleccion] = useState(null) // { archivo, url } (url = vista previa local)
  const archivo = seleccion?.archivo ?? null
  const vista = seleccion?.url ?? null
  const [errorFoto, setErrorFoto] = useState('')
  const [avisoFoto, setAvisoFoto] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [quitando, setQuitando] = useState(false)
  // Nombre: null = sin tocar (el campo muestra el valor guardado).
  const [texto, setTexto] = useState(null)
  const [errorNombre, setErrorNombre] = useState('')
  const [avisoNombre, setAvisoNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Guarda contra el doble envío: el estado tarda un render en deshabilitar los botones, la referencia no.
  const ocupado = useRef(false)
  const entradaFoto = useRef(null)
  const urlVista = useRef(null)

  // La vista previa es una URL local (blob): se libera al cambiar de archivo, al descartarla y al salir de la página.
  const fijarSeleccion = (archivoNuevo) => {
    if (urlVista.current) URL.revokeObjectURL(urlVista.current)
    urlVista.current = archivoNuevo ? URL.createObjectURL(archivoNuevo) : null
    setSeleccion(archivoNuevo ? { archivo: archivoNuevo, url: urlVista.current } : null)
  }
  useEffect(
    () => () => {
      if (urlVista.current) URL.revokeObjectURL(urlVista.current)
    },
    []
  )

  if (!perfil) {
    if (error || !cargando) return <ErrorCarga variante="oscuro" mensaje={error || 'No pudimos cargar tu perfil'} onReintentar={recargar} />
    return (
      <p role="status" className="py-10 text-center text-zinc-400">
        Cargando tu perfil...
      </p>
    )
  }

  const trabajando = subiendo || quitando || guardando

  // Ejecuta una acción del perfil con la guarda de doble envío; `aplicar` refresca el perfil de todo el panel al instante.
  const ejecutar = async (accion, { marcar, alError, alExito }) => {
    if (ocupado.current) return
    ocupado.current = true
    marcar(true)
    try {
      aplicar(await accion())
      alExito()
    } catch (err) {
      alError(mensajeErrorPerfil(err))
    } finally {
      ocupado.current = false
      marcar(false)
    }
  }

  const elegirFoto = (e) => {
    const elegida = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!elegida) return
    setAvisoFoto('')
    const mensaje = validarFoto(elegida)
    setErrorFoto(mensaje)
    fijarSeleccion(mensaje ? null : elegida)
  }

  const cancelarFoto = () => {
    fijarSeleccion(null)
    setErrorFoto('')
  }

  const guardarFoto = () => {
    if (!archivo) return
    setErrorFoto('')
    setAvisoFoto('')
    ejecutar(() => subirFotoPerfil(token, archivo), {
      marcar: setSubiendo,
      alError: setErrorFoto,
      alExito: () => {
        fijarSeleccion(null)
        setAvisoFoto('Foto actualizada')
      },
    })
  }

  const quitarFoto = () => {
    setErrorFoto('')
    setAvisoFoto('')
    ejecutar(() => quitarFotoPerfil(token), {
      marcar: setQuitando,
      alError: setErrorFoto,
      alExito: () => setAvisoFoto('Foto quitada. Se muestra tu foto pública'),
    })
  }

  const guardado = perfil.nombre_perfil ?? ''
  const valor = texto ?? guardado
  const { valor: normalizado, mensaje } = validarNombrePerfil(valor)
  const vacio = valor.trim() === ''
  const largo = Array.from(valor).length
  // Un campo vacío solo es un problema si ya había un nombre de perfil guardado (se vuelve al público con el botón).
  const errorLocal = vacio
    ? guardado
      ? 'Escribe entre 2 y 40 caracteres, o usa «Usar mi nombre público»'
      : ''
    : (mensaje ?? '')
  const sinCambios = !vacio && normalizado === guardado
  const idsDescripcion = `nombre-perfil-contador ${errorLocal || errorNombre ? 'nombre-perfil-error' : 'nombre-perfil-ayuda'}`

  const guardarNombre = (e) => {
    e.preventDefault()
    if (errorLocal || vacio || sinCambios) return
    setErrorNombre('')
    setAvisoNombre('')
    ejecutar(() => actualizarPerfil(token, normalizado), {
      marcar: setGuardando,
      alError: setErrorNombre,
      alExito: () => {
        setTexto(null)
        setAvisoNombre('Nombre actualizado')
      },
    })
  }

  const usarNombrePublico = () => {
    setErrorNombre('')
    setAvisoNombre('')
    ejecutar(() => actualizarPerfil(token, null), {
      marcar: setGuardando,
      alError: setErrorNombre,
      alExito: () => {
        setTexto(null)
        setAvisoNombre('Ahora se muestra tu nombre público')
      },
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-playfair text-3xl font-semibold">Configuración</h1>

      <p className="flex min-w-0 items-start gap-2 rounded-xl border border-oro/30 bg-oro/5 p-3 text-sm text-zinc-200">
        <FiInfo aria-hidden="true" className="mt-0.5 shrink-0 text-lg text-oro" />
        <span className="wrap-anywhere">Esta foto y este nombre solo se ven en tu panel. No cambian lo que ven los clientes en la web.</span>
      </p>

      <section aria-labelledby="titulo-foto-perfil" className={TARJETA}>
        <h2 id="titulo-foto-perfil" className="text-lg font-semibold">Foto de perfil</h2>

        <div className="mt-4 flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center">
          {vista ? (
            <img src={vista} alt="Vista previa de tu nueva foto" className="size-28 shrink-0 rounded-full object-cover ring-2 ring-oro sm:size-32" />
          ) : (
            <AvatarBarbero
              barbero={{ nombre: perfil.nombre, foto: resolverUrlFoto(perfil) }}
              descripcion={esAdmin ? 'administrador' : undefined}
              className="size-28 rounded-full sm:size-32"
              textoClase="text-4xl"
              cargaPerezosa={false}
            />
          )}

          <div className="flex w-full min-w-0 flex-col gap-3">
            {archivo && <p className="wrap-anywhere text-sm text-zinc-300">Vista previa: {archivo.name}. Aún no se ha guardado.</p>}

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label htmlFor="foto-perfil" className="sr-only">Archivo de foto de perfil</label>
              <input
                ref={entradaFoto}
                id="foto-perfil"
                type="file"
                accept={TIPOS_FOTO.join(',')}
                tabIndex={-1}
                className="sr-only"
                onChange={elegirFoto}
              />
              {archivo ? (
                <>
                  <button type="button" onClick={guardarFoto} disabled={trabajando} className={BOTON_PRIMARIO}>
                    {subiendo ? 'Guardando...' : 'Guardar foto'}
                  </button>
                  <button type="button" onClick={cancelarFoto} disabled={trabajando} className={BOTON_SECUNDARIO}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => entradaFoto.current?.click()} disabled={trabajando} className={BOTON_PRIMARIO}>
                  <FiCamera aria-hidden="true" />
                  Cambiar foto
                </button>
              )}
              {perfil.foto_propia && !archivo && (
                <button type="button" onClick={quitarFoto} disabled={trabajando} className={BOTON_SECUNDARIO}>
                  <FiTrash2 aria-hidden="true" />
                  {quitando ? 'Quitando...' : 'Quitar foto'}
                </button>
              )}
            </div>

            <p className="text-xs text-zinc-400">JPEG, PNG o WebP, de hasta 2 MB. Si la quitas, se vuelve a tu foto pública o a tus iniciales.</p>
          </div>
        </div>

        {errorFoto && (
          <p role="alert" className="wrap-anywhere mt-4 text-sm text-red-400">
            {errorFoto}
          </p>
        )}
        <p role="status" aria-live="polite" className="wrap-anywhere mt-4 text-sm text-green-400 empty:hidden">
          {avisoFoto}
        </p>
      </section>

      <section aria-labelledby="titulo-nombre-perfil" className={TARJETA}>
        <h2 id="titulo-nombre-perfil" className="text-lg font-semibold">Nombre de perfil</h2>

        <form onSubmit={guardarNombre} noValidate className="mt-4 flex max-w-md min-w-0 flex-col gap-4">
          <CampoFormulario
            id="nombre-perfil"
            etiqueta="Nombre de perfil"
            error={errorLocal || errorNombre}
            ayuda={`Entre ${LIMITES_PERFIL.nombreMin} y ${LIMITES_PERFIL.nombreMax} caracteres. Déjalo como está para seguir con tu nombre público.`}
          >
            <input
              id="nombre-perfil"
              type="text"
              value={valor}
              placeholder={nombrePublico}
              autoComplete="off"
              aria-invalid={Boolean(errorLocal || errorNombre)}
              aria-describedby={idsDescripcion}
              onChange={(e) => {
                setTexto(e.target.value)
                setErrorNombre('')
                setAvisoNombre('')
              }}
              className={`${ESTILO_CAMPO} ${errorLocal || errorNombre ? 'border-red-500' : 'border-white/15'}`}
            />
            <p id="nombre-perfil-contador" className={`text-right text-xs ${largo > LIMITES_PERFIL.nombreMax ? 'text-red-400' : 'text-zinc-500'}`}>
              {largo}/{LIMITES_PERFIL.nombreMax}
            </p>
          </CampoFormulario>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="submit" disabled={trabajando || vacio || Boolean(errorLocal) || sinCambios} className={BOTON_PRIMARIO}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            {!perfil.usa_nombre_publico && (
              <button type="button" onClick={usarNombrePublico} disabled={trabajando} className={BOTON_SECUNDARIO}>
                Usar mi nombre público
              </button>
            )}
          </div>

          <p role="status" aria-live="polite" className="wrap-anywhere text-sm text-green-400 empty:hidden">
            {avisoNombre}
          </p>
        </form>

        <dl className="mt-5 grid min-w-0 grid-cols-1 gap-x-8 gap-y-3 border-t border-white/10 pt-5 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{esAdmin ? 'Nombre por defecto' : 'Nombre público'}</dt>
            <dd className="wrap-anywhere">{nombrePublico}</dd>
            <dd className="mt-1 text-xs text-zinc-500">
              {esAdmin ? 'Es el que se muestra si no pones un nombre de perfil.' : 'Es el que ven los clientes en la web. No se puede cambiar desde aquí.'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Usuario de acceso</dt>
            <dd className="wrap-anywhere">{usuario.usuario}</dd>
            <dd className="mt-1 text-xs text-zinc-500">Con este usuario inicias sesión. No se puede cambiar desde aquí.</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

export default Configuracion
