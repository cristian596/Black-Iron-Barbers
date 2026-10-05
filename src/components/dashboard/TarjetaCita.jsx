import BadgeEstado from '../ui/BadgeEstado'
import { fechaLegible, soloHora } from '../../utils/formato'

const TarjetaCita = ({
  cita,
  mostrarBarbero = false,
  onReasignar,
  barberosActivos,
}) => {
  const puedeGestionar =
    cita.estado === 'pendiente' && onReasignar

  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4 text-white shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{cita.cliente}</p>
          <p className="text-sm text-gray-400">{cita.servicio_nombre}</p>
        </div>
        <BadgeEstado estado={cita.estado} vencida={cita.vencida} />
      </div>

      <div className="mt-2 space-y-0.5 text-sm text-gray-300">
        <p>{fechaLegible(cita.fecha)} · {soloHora(cita.hora)}</p>
        <p>{cita.correo}</p>
        {mostrarBarbero && <p>Barbero: {cita.barbero_nombre}</p>}
      </div>

      {puedeGestionar && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onReasignar && barberosActivos && (
            <label className="flex items-center gap-1 text-sm text-gray-300">
              <span className="sr-only">Reasignar barbero de la cita de {cita.cliente}</span>
              <select
                value={cita.barbero_id}
                onChange={(e) => onReasignar(cita, e.target.value)}
                className="min-h-11 rounded-lg border border-white/20 bg-[#1a1a1a] p-1.5 text-sm text-white"
              >
                {barberosActivos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

export default TarjetaCita
