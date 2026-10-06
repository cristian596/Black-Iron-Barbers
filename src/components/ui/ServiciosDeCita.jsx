import { formatearDuracion } from '../../utils/formato'
import { esCombo } from '../../utils/servicios'

// Servicio(s) de una cita en los paneles. Con un solo servicio es el nombre de siempre (un <p>). Con varios:
//  · `detalle`: lista con la duración de cada servicio (donde hay espacio);
//  · sin `detalle`: los nombres unidos con " + " en una línea que se ajusta (y con `title` por si se recorta).
// Siempre con ajuste de línea (`wrap-anywhere`) para que un nombre largo no desborde el contenedor.
const ServiciosDeCita = ({ cita, detalle = false, className = '' }) => {
  if (!esCombo(cita)) return <p className={`wrap-anywhere ${className}`}>{cita.servicio_nombre}</p>

  if (!detalle) {
    return (
      <p title={cita.servicio_nombre} className={`wrap-anywhere ${className}`}>
        {cita.servicio_nombre}
      </p>
    )
  }

  return (
    <ul aria-label={`${cita.servicios.length} servicios`} className={`space-y-0.5 ${className}`}>
      {cita.servicios.map((servicio) => (
        <li key={servicio.id} className="flex items-start justify-between gap-2">
          <span className="min-w-0 wrap-anywhere">{servicio.nombre}</span>
          <span className="shrink-0 whitespace-nowrap text-xs opacity-70">{formatearDuracion(servicio.duracion_min)}</span>
        </li>
      ))}
    </ul>
  )
}

export default ServiciosDeCita
