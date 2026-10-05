import BadgeEstado from '../ui/BadgeEstado'
import TarjetaCita from './TarjetaCita'
import { fechaLegible, soloHora } from '../../utils/formato'

const TablaCitas = ({
  citas,
  mostrarBarbero = false,
  onCompletar,
  onCancelar,
  onReasignar,
  barberosActivos,
}) => {
  if (citas.length === 0) return null

  const hayAcciones = Boolean(onCompletar || onCancelar || onReasignar)

  return (
    <>
      {/* Vista de tabla en escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-160 text-left text-sm text-white">
          <thead>
            <tr className="border-b border-white/10 text-gray-400">
              <th className="py-2 pr-3 font-medium">Cliente</th>
              <th className="py-2 pr-3 font-medium">Servicio</th>
              {mostrarBarbero && <th className="py-2 pr-3 font-medium">Barbero</th>}
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Hora</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              {hayAcciones && <th className="py-2 pr-3 font-medium">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {citas.map((cita) => (
              <tr key={cita.id} className="border-b border-white/5">
                <td className="py-2 pr-3">{cita.cliente}</td>
                <td className="py-2 pr-3">{cita.servicio_nombre}</td>
                {mostrarBarbero && <td className="py-2 pr-3">{cita.barbero_nombre}</td>}
                <td className="py-2 pr-3">{fechaLegible(cita.fecha)}</td>
                <td className="py-2 pr-3">{soloHora(cita.hora)}</td>
                <td className="py-2 pr-3"><BadgeEstado estado={cita.estado} vencida={cita.vencida} /></td>
                {hayAcciones && (
                  <td className="py-2 pr-3">
                    {cita.estado === 'pendiente' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {onCompletar && (
                          <button
                            type="button"
                            onClick={() => onCompletar(cita)}
                            className="min-h-11 cursor-pointer rounded-lg bg-green-600 px-3 text-xs font-medium text-white duration-200 hover:bg-green-500 active:scale-95"
                          >
                            Completar
                          </button>
                        )}
                        {onCancelar && (
                          <button
                            type="button"
                            onClick={() => onCancelar(cita)}
                            className="min-h-11 cursor-pointer rounded-lg bg-red-600 px-3 text-xs font-medium text-white duration-200 hover:bg-red-500 active:scale-95"
                          >
                            Cancelar
                          </button>
                        )}
                        {onReasignar && barberosActivos && (
                          <label className="flex items-center gap-1 text-xs text-gray-300">
                            <span className="sr-only">Reasignar barbero de la cita de {cita.cliente}</span>
                            <select
                              value={cita.barbero_id}
                              onChange={(e) => onReasignar(cita, e.target.value)}
                              className="min-h-11 rounded-lg border border-white/20 bg-[#1a1a1a] p-1 text-xs text-white"
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
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista de tarjetas en móvil */}
      <div className="flex flex-col gap-3 md:hidden">
        {citas.map((cita) => (
          <TarjetaCita
            key={cita.id}
            cita={cita}
            mostrarBarbero={mostrarBarbero}
            onCompletar={onCompletar}
            onCancelar={onCancelar}
            onReasignar={onReasignar}
            barberosActivos={barberosActivos}
          />
        ))}
      </div>
    </>
  )
}

export default TablaCitas
