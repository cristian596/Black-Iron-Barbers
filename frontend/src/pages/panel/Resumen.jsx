import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useResumenBarbero } from '../../context/ResumenBarberoContext'
import { useCarga } from '../../hooks/useCarga'
import { useAccionesCita } from '../../hooks/useAccionesCita'
import { obtenerAgendaHoy } from '../../services/api'
import { formatearFechaLegible, hoyISO } from '../../utils/fechas'
import TarjetasResumen from '../../components/panel/TarjetasResumen'
import AgendaHoy from '../../components/panel/AgendaHoy'
import SeccionPorConfirmar from '../../components/panel/SeccionPorConfirmar'
import Esqueleto from '../../components/panel/Esqueleto'
import ErrorCarga from '../../components/ui/ErrorCarga'

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

// /panel: Resumen del barbero. El resumen y las citas por confirmar vienen del estado compartido del layout (una sola
// petición para la ventana de bienvenida, el aviso persistente y esta pantalla); la agenda de hoy se recarga a la par
// (misma `version`). Completar o cancelar recarga todo.
const Resumen = () => {
  const { token } = useAuth()
  const { resumen, porConfirmar, cargando, error, recargar, version, barbero } = useResumenBarbero()
  const location = useLocation()
  const encabezadoPorConfirmarRef = useRef(null)

  const agenda = useCarga(() => obtenerAgendaHoy(token), String(version))
  const acciones = useAccionesCita(token, recargar)

  // Llegar con #por-confirmar (aviso persistente o ventana de bienvenida) lleva a la sección y le da el foco.
  const hayPorConfirmar = porConfirmar !== null
  useEffect(() => {
    if (location.hash !== '#por-confirmar' || !hayPorConfirmar) return
    const encabezado = encabezadoPorConfirmarRef.current
    encabezado?.scrollIntoView?.({ block: 'start' })
    encabezado?.focus({ preventScroll: true })
  }, [location.hash, location.key, hayPorConfirmar])

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header>
        <h1 className="wrap-anywhere font-playfair text-3xl font-semibold sm:text-4xl">Hola, {barbero.nombre}</h1>
        <p className="mt-1 text-zinc-400">{mayuscula(formatearFechaLegible(hoyISO()))}</p>
      </header>

      {acciones.error && (
        <p className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300" role="alert">
          {acciones.error}
        </p>
      )}

      {error && !resumen ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950">
          <ErrorCarga mensaje="No pudimos cargar tu resumen." onReintentar={recargar} variante="oscuro" />
        </div>
      ) : !resumen ? (
        <Esqueleto filas={2} alto="h-28" etiqueta="Cargando tu resumen..." className="sm:grid sm:grid-cols-2 xl:grid-cols-4" />
      ) : (
        <div aria-busy={cargando}>
          <TarjetasResumen resumen={resumen} />
        </div>
      )}

      <AgendaHoy
        datos={agenda.datos}
        cargando={agenda.cargando}
        error={agenda.error}
        alReintentar={agenda.recargar}
        ocupadoId={acciones.ocupadoId}
        alCompletar={acciones.completar}
        alCancelar={acciones.pedirCancelar}
      />

      <SeccionPorConfirmar
        encabezadoRef={encabezadoPorConfirmarRef}
        datos={porConfirmar}
        error={error}
        alReintentar={recargar}
        ocupadoId={acciones.ocupadoId}
        alCompletar={acciones.completar}
        alCancelar={acciones.pedirCancelar}
      />

      {acciones.modalCancelar}
    </div>
  )
}

export default Resumen
