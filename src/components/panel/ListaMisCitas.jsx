import BadgeEstado from '../ui/BadgeEstado'
import AccionesCita from './AccionesCita'
import { InsigniaPorConfirmar } from './AgendaHoy'
import { fechaLegible, formatearPrecio, soloHora } from '../../utils/formato'

const Estado = ({ cita }) => (
  <span className="flex flex-wrap items-center gap-2">
    <BadgeEstado estado={cita.estado} />
    {cita.por_confirmar && <InsigniaPorConfirmar />}
  </span>
)

const Tarjeta = ({ cita, ocupado, alCompletar, alCancelar }) => (
  <li className={`min-w-0 rounded-xl border bg-zinc-950 p-4 ${cita.por_confirmar ? 'border-orange-400/40' : 'border-white/10'}`}>
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <p className="text-sm font-semibold text-oro">
        <time>{fechaLegible(cita.fecha)} · {soloHora(cita.hora)}</time>
      </p>
      <Estado cita={cita} />
    </div>
    <p className="mt-2 wrap-anywhere text-base font-semibold">{cita.cliente}</p>
    <p className="mt-1 wrap-anywhere text-sm text-zinc-400">
      {cita.servicio_nombre} · {cita.duracion_min} min · {formatearPrecio(cita.precio)}
    </p>
    {cita.estado === 'pendiente' && (
      <AccionesCita cita={cita} ocupado={ocupado} alCompletar={alCompletar} alCancelar={alCancelar} />
    )}
  </li>
)

const Tabla = ({ citas, ocupadoId, alCompletar, alCancelar }) => (
  <div className="min-w-0 overflow-x-auto">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">Mis citas</caption>
      <thead>
        <tr className="border-b border-white/10 text-zinc-400">
          <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
          <th scope="col" className="py-2 pr-3 font-medium">Hora</th>
          <th scope="col" className="py-2 pr-3 font-medium">Cliente</th>
          <th scope="col" className="py-2 pr-3 font-medium">Servicio</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">Duración</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">Precio</th>
          <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
          <th scope="col" className="py-2 font-medium"><span className="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        {citas.map((cita) => (
          <tr key={cita.id} className="border-b border-white/5 align-middle">
            <td className="py-2 pr-3 whitespace-nowrap text-zinc-300">{fechaLegible(cita.fecha)}</td>
            <td className="py-2 pr-3 font-semibold whitespace-nowrap text-oro">{soloHora(cita.hora)}</td>
            <th scope="row" className="min-w-40 py-2 pr-3 font-medium wrap-anywhere">{cita.cliente}</th>
            <td className="min-w-36 py-2 pr-3 text-zinc-300 wrap-anywhere">{cita.servicio_nombre}</td>
            <td className="py-2 pr-3 text-right whitespace-nowrap">{cita.duracion_min} min</td>
            <td className="py-2 pr-3 text-right whitespace-nowrap">{formatearPrecio(cita.precio)}</td>
            <td className="py-2 pr-3"><Estado cita={cita} /></td>
            <td className="py-2">
              {cita.estado === 'pendiente' && (
                <div className="-mt-3 flex justify-end">
                  <AccionesCita cita={cita} ocupado={ocupadoId === cita.id} alCompletar={alCompletar} alCancelar={alCancelar} />
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// Escritorio (≥ 1280 px): tabla real. Por debajo: tarjetas. Una sola vista en el DOM según `tabla`.
const ListaMisCitas = ({ citas, tabla, ocupadoId, alCompletar, alCancelar }) =>
  tabla ? (
    <Tabla citas={citas} ocupadoId={ocupadoId} alCompletar={alCompletar} alCancelar={alCancelar} />
  ) : (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {citas.map((cita) => (
        <Tarjeta key={cita.id} cita={cita} ocupado={ocupadoId === cita.id} alCompletar={alCompletar} alCancelar={alCancelar} />
      ))}
    </ul>
  )

export default ListaMisCitas
