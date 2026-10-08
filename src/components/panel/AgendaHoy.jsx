import BadgeEstado from '../ui/BadgeEstado'
import ServiciosDeCita from '../ui/ServiciosDeCita'
import { esCombo } from '../../utils/servicios'
import ErrorCarga from '../ui/ErrorCarga'
import SinResultados from '../ui/SinResultados'
import Esqueleto from './Esqueleto'
import AccionesCita from './AccionesCita'
import ReservaCombinada from '../ui/ReservaCombinada'
import { formatearPrecio, soloHora } from '../../utils/formato'

export const InsigniaPorConfirmar = () => (
  <span className="inline-block whitespace-nowrap rounded-full border border-orange-400 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-900">
    Por confirmar
  </span>
)

// Agenda de hoy como línea de tiempo vertical por hora. Cada cita pendiente se puede completar o cancelar.
const AgendaHoy = ({ datos, cargando, error, alReintentar, ocupadoId, alCompletar, alCancelar }) => (
  <section aria-labelledby="titulo-agenda" aria-busy={cargando} className="min-w-0">
    <h2 id="titulo-agenda" className="mb-3 font-playfair text-2xl font-semibold">Agenda de hoy</h2>
    {error && !datos ? (
      <div className="rounded-xl border border-white/10 bg-zinc-950">
        <ErrorCarga mensaje="No pudimos cargar tu agenda de hoy." onReintentar={alReintentar} variante="oscuro" />
      </div>
    ) : !datos ? (
      <Esqueleto filas={3} etiqueta="Cargando tu agenda de hoy..." />
    ) : datos.citas.length === 0 ? (
      <div className="rounded-xl border border-white/10 bg-zinc-950">
        <SinResultados variante="oscuro" mensaje="Hoy no tienes citas agendadas." />
      </div>
    ) : (
      <ol className="flex min-w-0 flex-col gap-3">
        {datos.citas.map((cita) => (
          <li key={cita.id} className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4rem_minmax(0,1fr)]">
            <time dateTime={soloHora(cita.hora)} className="pt-3 text-sm font-semibold text-oro">
              {soloHora(cita.hora)}
            </time>
            <div className="min-w-0 rounded-xl border border-white/10 border-l-3 border-l-oro/60 bg-zinc-950 p-3 sm:p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 wrap-anywhere text-base font-semibold">{cita.cliente}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {cita.por_confirmar && <InsigniaPorConfirmar />}
                  <BadgeEstado estado={cita.estado} />
                </div>
              </div>
              {esCombo(cita) ? (
                <>
                  <ServiciosDeCita cita={cita} detalle className="mt-1 text-sm text-zinc-400" />
                  <p className="mt-1 text-sm text-zinc-400">
                    Total {cita.duracion_min} min · {formatearPrecio(cita.precio)}
                  </p>
                </>
              ) : (
                <p className="mt-1 wrap-anywhere text-sm text-zinc-400">
                  {cita.servicio_nombre} · {cita.duracion_min} min · {formatearPrecio(cita.precio)}
                </p>
              )}
              <ReservaCombinada cita={cita} className="mt-2" />
              {cita.estado === 'pendiente' && (
                <AccionesCita cita={cita} ocupado={ocupadoId === cita.id} alCompletar={alCompletar} alCancelar={alCancelar} />
              )}
            </div>
          </li>
        ))}
      </ol>
    )}
  </section>
)

export default AgendaHoy
