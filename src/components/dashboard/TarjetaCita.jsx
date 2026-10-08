import BadgeEstado from '../ui/BadgeEstado'
import ServiciosDeCita from '../ui/ServiciosDeCita'
import ReservaCombinada, { EtiquetaArea } from '../ui/ReservaCombinada'
import { AREA_ASESORIA, profesionalesDeArea } from '../../utils/areas'
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
        <div className="min-w-0">
          <p className="text-lg font-semibold">{cita.cliente}</p>
          <ServiciosDeCita cita={cita} detalle className="text-sm text-gray-400" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <EtiquetaArea area={cita.area} />
          <BadgeEstado estado={cita.estado} vencida={cita.vencida} />
        </div>
      </div>
      <ReservaCombinada cita={cita} className="mt-2" />

      <div className="mt-2 space-y-0.5 text-sm text-gray-300">
        <p>{fechaLegible(cita.fecha)} · {soloHora(cita.hora)}</p>
        <p>{cita.correo}</p>
        {mostrarBarbero && <p>{cita.area === AREA_ASESORIA ? 'Asesor/a' : 'Barbero'}: {cita.barbero_nombre}</p>}
      </div>

      {puedeGestionar && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onReasignar && barberosActivos && (
            <label className="flex items-center gap-1 text-sm text-gray-300">
              <span className="sr-only">
                {cita.area === AREA_ASESORIA ? 'Reasignar asesor/a' : 'Reasignar barbero'} de la cita de {cita.cliente}
              </span>
              <select
                value={cita.barbero_id}
                onChange={(e) => onReasignar(cita, e.target.value)}
                className="min-h-11 rounded-lg border border-white/20 bg-[#1a1a1a] p-1.5 text-sm text-white"
              >
                {profesionalesDeArea(barberosActivos, cita.area).map((b) => (
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
