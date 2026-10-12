import { formatearDuracion, formatearPrecio } from '../../../utils/formato'

// Etiqueta "Gratis · 15 min" / "$60.000 · 1 h" (precio 0 = Gratis, con el formateador de siempre).
const EtiquetaAsesoria = ({ precio, duracion_min: duracion }) => (
  <p
    className={`w-fit rounded-full px-3 py-1 font-poppins text-xs font-semibold uppercase tracking-wide ${
      precio === 0 ? 'bg-oro text-black' : 'border border-oro/50 text-oro'
    }`}
  >
    {formatearPrecio(precio)} · {formatearDuracion(duracion)}
  </p>
)

export default EtiquetaAsesoria
