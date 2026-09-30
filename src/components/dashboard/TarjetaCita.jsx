import BadgeEstado from '../ui/BadgeEstado'
import { fechaLegible, soloHora } from '../../utils/formato'

const TarjetaCita = ({ cita, mostrarBarbero = false, onCompletar, onCancelar }) => {
  const puedeGestionar = cita.estado === 'pendiente' && (onCompletar || onCancelar)

  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4 text-white shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{cita.cliente}</p>
          <p className="text-sm text-gray-400">{cita.servicio_nombre}</p>
        </div>
        <BadgeEstado estado={cita.estado} />
      </div>

      <div className="mt-2 space-y-0.5 text-sm text-gray-300">
        <p>{fechaLegible(cita.fecha)} · {soloHora(cita.hora)}</p>
        <p>{cita.correo}</p>
        {mostrarBarbero && <p>Barbero: {cita.barbero_nombre}</p>}
      </div>

      {puedeGestionar && (
        <div className="mt-3 flex gap-2">
          {onCompletar && (
            <button
              type="button"
              onClick={() => onCompletar(cita)}
              className="cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white duration-200 hover:bg-green-500 active:scale-95"
            >
              Completar
            </button>
          )}
          {onCancelar && (
            <button
              type="button"
              onClick={() => onCancelar(cita)}
              className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white duration-200 hover:bg-red-500 active:scale-95"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default TarjetaCita
