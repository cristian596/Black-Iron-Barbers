import { FiClock } from 'react-icons/fi'
import { textoVigencia } from '../../utils/vigencia'

const ESTILO = {
  vigente: 'border-white/10 text-zinc-400',
  por_vencer: 'border-amber-500/50 text-amber-300',
  caducada: 'border-red-500/50 text-red-300',
}

// Indicador discreto del estado de la contraseña de un barbero. El estado va en texto (no solo en color).
const IndicadorVigencia = ({ vigencia }) => {
  if (!vigencia) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ESTILO[vigencia.estado]}`}>
      <FiClock aria-hidden="true" />
      <span className="sr-only">Contraseña: </span>
      {textoVigencia(vigencia)}
    </span>
  )
}

export default IndicadorVigencia
