import { FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { formatearDelta } from '../../utils/formato'

const COLOR_SUBE = 'text-emerald-400'
const COLOR_BAJA = 'text-red-400'

// `invertir`: que el número suba es malo (canceladas), así que los colores se intercambian.
const estiloDelta = (direccion, invertir) => {
  if (direccion === 'sube') return invertir ? COLOR_BAJA : COLOR_SUBE
  if (direccion === 'baja') return invertir ? COLOR_SUBE : COLOR_BAJA
  return 'text-zinc-400'
}

const DESCRIPCION = {
  sube: (t) => `${t} más que en el período anterior`,
  baja: (t) => `${t} menos que en el período anterior`,
  igual: () => 'Igual que en el período anterior',
  'sin-base': () => 'Sin base de comparación: el período anterior no tiene datos',
}

// `nota`: texto libre bajo el valor en lugar de la comparación con el período anterior (panel del barbero).
// `detalle`: línea extra bajo la comparación (p. ej. el desglose de los ingresos por área).
const TarjetaIndicador = ({ etiqueta, valor, actual, previo, invertir = false, nota, detalle, className = '' }) => {
  const { texto, direccion } = formatearDelta(actual, previo)

  return (
    <div className={`min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 ${className}`}>
      <p className="truncate text-xs font-medium uppercase tracking-wide text-zinc-400">{etiqueta}</p>
      <p className="mt-1 truncate font-poppins text-2xl font-semibold text-white sm:text-3xl">{valor}</p>
      {nota !== undefined ? (
        <p className="mt-2 wrap-anywhere text-sm text-zinc-400">{nota}</p>
      ) : (
        <p className={`mt-2 flex items-center gap-1 text-sm font-medium ${estiloDelta(direccion, invertir)}`}>
          {direccion === 'sube' && <FiArrowUp aria-hidden="true" />}
          {direccion === 'baja' && <FiArrowDown aria-hidden="true" />}
          <span aria-hidden="true">{texto}</span>
          <span className="sr-only">{DESCRIPCION[direccion](texto)}</span>
        </p>
      )}
      {detalle && <p className="mt-1 wrap-anywhere text-xs text-zinc-400">{detalle}</p>}
    </div>
  )
}

export default TarjetaIndicador
