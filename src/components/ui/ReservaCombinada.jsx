import BadgeEstado from './BadgeEstado'
import { soloHora } from '../../utils/formato'
import { AREA_ASESORIA, textoArea } from '../../utils/areas'

// Etiqueta del área de una cita ("Barbería" / "Asesoría"). Sin `area` no se pinta nada (respuestas anteriores).
export const EtiquetaArea = ({ area, className = '' }) =>
  area ? (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${
        area === AREA_ASESORIA ? 'border-oro text-oro' : 'border-zinc-500 text-zinc-200'
      } ${className}`}
    >
      {textoArea(area)}
    </span>
  ) : null

// Si la cita es parte de una reserva combinada (asesoría + corte, mismo cliente y mismo día) muestra la etiqueta
// "Reserva combinada" y el contexto de la OTRA cita: de qué área es, con quién, de qué hora a qué hora y su estado.
// Solo usa los campos mínimos de `cita.hermana` ({ area, profesional, hora_inicio, hora_fin, estado }); no enlaza a la
// otra cita ni muestra nada más (esa cita es de otro profesional). Sin hermana no pinta nada.
const ReservaCombinada = ({ cita, className = '' }) => {
  const hermana = cita?.hermana
  if (!hermana) return null
  return (
    <div className={`min-w-0 rounded-lg border border-oro/40 bg-oro/10 p-2 text-sm text-zinc-200 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-block whitespace-nowrap rounded-full bg-oro px-2.5 py-0.5 text-xs font-semibold text-black">
          Reserva combinada
        </span>
        <span className="min-w-0 wrap-anywhere">
          Su otra cita: {textoArea(hermana.area)} con {hermana.profesional}, de {soloHora(hermana.hora_inicio)} a{' '}
          {soloHora(hermana.hora_fin)}
        </span>
        <BadgeEstado estado={hermana.estado} />
      </div>
    </div>
  )
}

export default ReservaCombinada
