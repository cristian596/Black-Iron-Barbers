import { formatearDuracion, formatearPrecio } from '../../../utils/formato'

// Servicios de una reserva con varios servicios: nombre (con ajuste de línea, sin desbordar) y, a la derecha, su
// duración (y el precio con `conPrecio`). Recibe { id, nombre, duracion_min, precio }.
const ListaServiciosReserva = ({ servicios, conPrecio = false }) => (
  <ul className="space-y-1">
    {servicios.map((servicio) => (
      <li key={servicio.id} className="flex items-start justify-between gap-2">
        <span className="min-w-0 wrap-anywhere">{servicio.nombre}</span>
        <span className="shrink-0 whitespace-nowrap text-xs font-normal text-zinc-500">
          {formatearDuracion(servicio.duracion_min)}
          {conPrecio && ` · ${formatearPrecio(servicio.precio)}`}
        </span>
      </li>
    ))}
  </ul>
)

export default ListaServiciosReserva
