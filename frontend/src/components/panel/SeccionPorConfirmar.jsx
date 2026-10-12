import ErrorCarga from '../ui/ErrorCarga'
import ServiciosDeCita from '../ui/ServiciosDeCita'
import { esCombo } from '../../utils/servicios'
import SinResultados from '../ui/SinResultados'
import ReservaCombinada from '../ui/ReservaCombinada'
import Esqueleto from './Esqueleto'
import AccionesCita from './AccionesCita'
import { fechaLegible, soloHora, tiempoTranscurrido } from '../../utils/formato'

// Sus citas pendientes cuyo fin + 2 h ya pasó, de la más antigua a la más reciente. El ancla #por-confirmar la usan
// el aviso persistente y la ventana de bienvenida (el encabezado recibe el foco al llegar con ese ancla).
const SeccionPorConfirmar = ({ encabezadoRef, datos, error, alReintentar, ocupadoId, alCompletar, alCancelar }) => (
  <section id="por-confirmar" aria-labelledby="titulo-por-confirmar" className="min-w-0 scroll-mt-20">
    <h2 ref={encabezadoRef} id="titulo-por-confirmar" tabIndex={-1} className="mb-3 font-playfair text-2xl font-semibold outline-none">
      Por confirmar
    </h2>
    {error && !datos ? (
      <div className="rounded-xl border border-white/10 bg-zinc-950">
        <ErrorCarga mensaje="No pudimos cargar tus citas por confirmar." onReintentar={alReintentar} variante="oscuro" />
      </div>
    ) : !datos ? (
      <Esqueleto filas={2} etiqueta="Cargando tus citas por confirmar..." />
    ) : datos.items.length === 0 ? (
      <div className="rounded-xl border border-white/10 bg-zinc-950">
        <SinResultados variante="oscuro" mensaje="No tienes citas por confirmar. Todo está al día." />
      </div>
    ) : (
      <>
        <p className="mb-3 text-sm text-zinc-400">
          Estas citas ya terminaron y siguen pendientes. Márcalas como completadas o cancélalas.
        </p>
        <ul className="flex min-w-0 flex-col gap-3">
          {datos.items.map((cita) => (
            <li key={cita.id} className="min-w-0 rounded-xl border border-orange-400/40 bg-zinc-950 p-3 sm:p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 wrap-anywhere text-base font-semibold">{cita.cliente}</p>
                <span className="text-xs font-medium text-orange-300">Vencida hace {tiempoTranscurrido(cita.vencida_hace_min)}</span>
              </div>
              {esCombo(cita) ? (
                <>
                  <ServiciosDeCita cita={cita} detalle className="mt-1 text-sm text-zinc-400" />
                  <p className="mt-1 text-sm text-zinc-400">
                    {fechaLegible(cita.fecha)} · {soloHora(cita.hora)} · Total {cita.duracion_min} min
                  </p>
                </>
              ) : (
                <p className="mt-1 wrap-anywhere text-sm text-zinc-400">
                  {cita.servicio_nombre} · {fechaLegible(cita.fecha)} · {soloHora(cita.hora)}
                </p>
              )}
              <ReservaCombinada cita={cita} className="mt-2" />
              <AccionesCita cita={cita} ocupado={ocupadoId === cita.id} alCompletar={alCompletar} alCancelar={alCancelar} />
            </li>
          ))}
        </ul>
        {datos.total > datos.items.length && (
          <p className="mt-3 text-sm text-zinc-400" role="status">
            Mostrando {datos.items.length} de {datos.total} citas por confirmar. Al cerrar estas aparecerán las demás.
          </p>
        )}
      </>
    )}
  </section>
)

export default SeccionPorConfirmar
