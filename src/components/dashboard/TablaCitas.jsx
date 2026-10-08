import BadgeEstado from '../ui/BadgeEstado'
import ServiciosDeCita from '../ui/ServiciosDeCita'
import { esCombo } from '../../utils/servicios'
import TarjetaCita from './TarjetaCita'
import ReservaCombinada, { EtiquetaArea } from '../ui/ReservaCombinada'
import { AREA_ASESORIA, profesionalesDeArea } from '../../utils/areas'
import { fechaLegible, soloHora } from '../../utils/formato'

const TablaCitas = ({
  citas,
  mostrarBarbero = false,
  onReasignar,
  barberosActivos,
}) => {
  if (citas.length === 0) return null

  const hayAcciones = Boolean(onReasignar)

  return (
    <>
      {/* Vista de tabla en escritorio */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full min-w-160 text-left text-sm text-white">
          <thead>
            <tr className="border-b border-white/10 text-gray-400">
              <th className="py-2 pr-3 font-medium">Cliente</th>
              <th className="py-2 pr-3 font-medium">Servicio</th>
              <th className="py-2 pr-3 font-medium">Área</th>
              {mostrarBarbero && <th className="py-2 pr-3 font-medium">Profesional</th>}
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
                <td className="py-2 pr-3">
                  {esCombo(cita) ? <ServiciosDeCita cita={cita} detalle /> : cita.servicio_nombre}
                  <ReservaCombinada cita={cita} className="mt-2" />
                </td>
                <td className="py-2 pr-3"><EtiquetaArea area={cita.area} /></td>
                {mostrarBarbero && <td className="py-2 pr-3">{cita.barbero_nombre}</td>}
                <td className="py-2 pr-3">{fechaLegible(cita.fecha)}</td>
                <td className="py-2 pr-3">{soloHora(cita.hora)}</td>
                <td className="py-2 pr-3"><BadgeEstado estado={cita.estado} vencida={cita.vencida} /></td>
                {hayAcciones && (
                  <td className="py-2 pr-3">
                    {cita.estado === 'pendiente' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {onReasignar && barberosActivos && (
                          <label className="flex items-center gap-1 text-xs text-gray-300">
                            <span className="sr-only">
                              {cita.area === AREA_ASESORIA ? 'Reasignar asesor/a' : 'Reasignar barbero'} de la cita de {cita.cliente}
                            </span>
                            <select
                              value={cita.barbero_id}
                              onChange={(e) => onReasignar(cita, e.target.value)}
                              className="min-h-11 rounded-lg border border-white/20 bg-[#1a1a1a] p-1 text-xs text-white"
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
            onReasignar={onReasignar}
            barberosActivos={barberosActivos}
          />
        ))}
      </div>
    </>
  )
}

export default TablaCitas
