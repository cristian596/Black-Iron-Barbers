import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FiCheck, FiRotateCcw } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useCambiosPerfil } from '../../context/CambiosPerfilContext'
import { restablecerPerfilBarbero, revisarCambiosPerfil } from '../../services/api'
import { fechaHoraBogota, fechaRelativa } from '../../utils/fechas'
import { resolverUrlFoto } from '../../utils/perfil'
import AvatarBarbero from '../ui/AvatarBarbero'
import ErrorCarga from '../ui/ErrorCarga'
import ModalConfirmar from './ModalConfirmar'

const BOTON_BASE =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
const BOTON_REVISAR = `${BOTON_BASE} bg-oro text-black hover:bg-oro/80`
const BOTON_RESTABLECER = `${BOTON_BASE} border border-red-500/50 text-red-300 hover:bg-red-600 hover:text-white`

export const ID_CAMBIOS_PERFIL = 'cambios-perfil'

// Texto de un cambio: el nombre se muestra con su valor anterior y el nuevo; de la foto solo se dice que cambió (el
// archivo anterior se borra, así que no se puede mostrar; la foto actual es el avatar de la tarjeta).
const DescripcionCambio = ({ cambio }) =>
  cambio.campo === 'nombre' ? (
    <span className="wrap-anywhere">
      Cambió su nombre de perfil: <span className="text-zinc-400 line-through">{cambio.valor_anterior}</span>
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> por </span>
      <strong className="font-semibold text-white">{cambio.valor_nuevo}</strong>
    </span>
  ) : (
    <span>Cambió su foto</span>
  )

// Vista de revisión del admin (/admin/configuracion): una tarjeta por barbero con cambios sin revisar. Usa el estado
// compartido de CambiosPerfilContext (el mismo del aviso persistente: no hay un segundo polling). Tras cada acción
// correcta el barbero sale de la lista y del aviso al instante y se vuelve a pedir el estado real.
const CambiosPerfilBarberos = () => {
  const { token } = useAuth()
  const { barberos, total, cargando, cargado, error, recargar, descartar } = useCambiosPerfil()
  const location = useLocation()
  const tituloRef = useRef(null)
  const ocupado = useRef(false)
  const [accion, setAccion] = useState(null) // { id, tipo: 'revisar' | 'restablecer' } mientras se ejecuta
  const [errores, setErrores] = useState({}) // por barbero: error de "Marcar como revisado"
  const [aRestablecer, setARestablecer] = useState(null) // barbero cuyo restablecimiento espera confirmación
  const [errorModal, setErrorModal] = useState('')

  // Llegar con #cambios-perfil (aviso persistente) lleva a la sección y le da el foco.
  useEffect(() => {
    if (location.hash !== `#${ID_CAMBIOS_PERFIL}`) return
    tituloRef.current?.scrollIntoView?.({ block: 'start' })
    tituloRef.current?.focus({ preventScroll: true })
  }, [location.hash, location.key, cargado])

  const terminar = (barberoId) => {
    descartar(barberoId)
    recargar()
    tituloRef.current?.focus({ preventScroll: true }) // la tarjeta (y el botón pulsado) ya no existe
  }

  const ejecutar = async (barbero, tipo, llamar, alError) => {
    if (ocupado.current) return
    ocupado.current = true
    setAccion({ id: barbero.barbero_id, tipo })
    try {
      await llamar(token, barbero.barbero_id)
      setErrores((previo) => ({ ...previo, [barbero.barbero_id]: '' }))
      terminar(barbero.barbero_id)
      return true
    } catch (err) {
      alError(err.message)
      return false
    } finally {
      ocupado.current = false
      setAccion(null)
    }
  }

  const marcarRevisado = (barbero) =>
    ejecutar(barbero, 'revisar', revisarCambiosPerfil, (mensaje) => setErrores((previo) => ({ ...previo, [barbero.barbero_id]: mensaje })))

  const confirmarRestablecer = async () => {
    const barbero = aRestablecer
    setErrorModal('')
    const exito = await ejecutar(barbero, 'restablecer', restablecerPerfilBarbero, setErrorModal)
    if (exito) setARestablecer(null)
  }

  const cancelarRestablecer = () => {
    if (accion) return
    setARestablecer(null)
    setErrorModal('')
  }

  return (
    <section id={ID_CAMBIOS_PERFIL} aria-labelledby="titulo-cambios-perfil" className="flex min-w-0 scroll-mt-20 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="titulo-cambios-perfil" ref={tituloRef} tabIndex={-1} className="font-playfair text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-oro">
          Cambios de perfil de barberos
        </h2>
        <p className="text-sm text-zinc-400">
          Foto y nombre de perfil que los barberos cambiaron para su panel. No afectan lo que ven los clientes en la web.
        </p>
      </div>

      {!cargado && cargando && (
        <p role="status" className="rounded-xl border border-white/10 bg-zinc-950 p-6 text-center text-zinc-400">
          Cargando cambios...
        </p>
      )}

      {!cargado && !cargando && error && (
        <div className="rounded-xl border border-white/10 bg-zinc-950">
          <ErrorCarga variante="oscuro" mensaje={error} onReintentar={recargar} />
        </div>
      )}

      {cargado && total === 0 && (
        <p className="rounded-xl border border-white/10 bg-zinc-950 p-6 text-center text-zinc-400">Sin cambios pendientes</p>
      )}

      {total > 0 && (
        <ul className="flex min-w-0 flex-col gap-4">
          {barberos.map((barbero) => {
            const trabajando = accion?.id === barbero.barbero_id
            const nombreActual = barbero.nombre_perfil ?? barbero.nombre
            return (
              <li key={barbero.barbero_id} className="min-w-0">
                <article aria-label={`Cambios de perfil de ${barbero.nombre}`} className="min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 sm:p-6">
                  <header className="flex min-w-0 items-center gap-4">
                    <AvatarBarbero
                      barbero={{ nombre: nombreActual, foto: resolverUrlFoto(barbero) }}
                      className="size-16 rounded-full"
                      textoClase="text-xl"
                      cargaPerezosa={false}
                    />
                    <div className="min-w-0">
                      <h3 className="wrap-anywhere font-playfair text-xl font-semibold">{barbero.nombre}</h3>
                      <p className="wrap-anywhere text-sm text-zinc-400">
                        {barbero.nombre_perfil ? `Nombre de perfil actual: ${barbero.nombre_perfil}` : 'Usa su nombre público'}
                      </p>
                    </div>
                  </header>

                  <ul className="mt-4 flex min-w-0 flex-col divide-y divide-white/10 border-y border-white/10 text-sm text-zinc-200">
                    {barbero.cambios.map((cambio) => (
                      <li key={cambio.id} className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                        <DescripcionCambio cambio={cambio} />
                        <time dateTime={cambio.creado_en} title={fechaHoraBogota(cambio.creado_en)} className="shrink-0 text-xs text-zinc-400">
                          {fechaRelativa(cambio.creado_en)}
                        </time>
                      </li>
                    ))}
                  </ul>

                  {errores[barbero.barbero_id] && (
                    <p role="alert" className="wrap-anywhere mt-4 text-sm text-red-400">
                      {errores[barbero.barbero_id]}
                    </p>
                  )}

                  <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => marcarRevisado(barbero)}
                      disabled={Boolean(accion)}
                      aria-label={`Marcar como revisado el perfil de ${barbero.nombre}`}
                      className={BOTON_REVISAR}
                    >
                      <FiCheck aria-hidden="true" />
                      {trabajando && accion.tipo === 'revisar' ? 'Guardando...' : 'Marcar como revisado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorModal('')
                        setARestablecer(barbero)
                      }}
                      disabled={Boolean(accion)}
                      aria-label={`Restablecer el perfil de ${barbero.nombre}`}
                      className={BOTON_RESTABLECER}
                    >
                      <FiRotateCcw aria-hidden="true" />
                      Restablecer perfil
                    </button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {aRestablecer && (
        <ModalConfirmar
          titulo={`¿Restablecer el perfil de ${aRestablecer.nombre}?`}
          texto={`${aRestablecer.nombre} volverá a ver en su panel su nombre y su foto públicos. Se borrará la foto que subió y se perderá su nombre de perfil. No afecta lo que ven los clientes en la web.`}
          textoConfirmar="Restablecer perfil"
          alConfirmar={confirmarRestablecer}
          alCerrar={cancelarRestablecer}
          cargando={accion?.tipo === 'restablecer'}
          error={errorModal}
          focoEnCancelar
        />
      )}
    </section>
  )
}

export default CambiosPerfilBarberos
