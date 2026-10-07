import { Link } from 'react-router-dom'
import { FaArrowDown } from 'react-icons/fa6'
import { ASESORIAS, rutaAsesoria } from '../../../data/asesorias'
import EtiquetaAsesoria from './EtiquetaAsesoria'

// Franja con las tres asesorías: cada tarjeta lleva a su sección dentro de la misma página.
const ResumenAsesorias = () => (
  <nav aria-label="Asesorías disponibles" className="border-y border-oro/20 bg-black px-4 py-8">
    <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
      {ASESORIAS.map(({ id, titulo, precio, duracion_min, Icono }) => (
        <li key={id} className="grid min-w-0">
          <Link
            to={rutaAsesoria(id)}
            className="group flex min-h-11 min-w-0 items-center gap-4 rounded-xl border border-white/10 bg-zinc-950 p-4 duration-300 hover:border-oro hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <Icono aria-hidden="true" size={26} className="shrink-0 text-oro" />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <span className="font-playfair text-lg font-semibold text-white wrap-anywhere">{titulo}</span>
              <EtiquetaAsesoria precio={precio} duracion_min={duracion_min} />
            </span>
            <FaArrowDown
              aria-hidden="true"
              size={14}
              className="shrink-0 text-oro duration-300 group-hover:translate-y-1 motion-reduce:transition-none"
            />
          </Link>
        </li>
      ))}
    </ul>
  </nav>
)

export default ResumenAsesorias
