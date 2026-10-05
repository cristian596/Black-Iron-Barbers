import { obtenerEstadisticas } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { PERIODOS } from '../../data/periodos'
import { INDICADORES } from '../../data/indicadores'
import { formatearDinero } from '../../utils/formato'
import { formatearRango } from '../../utils/fechas'
import TarjetaIndicador from './TarjetaIndicador'
import ErrorCarga from '../ui/ErrorCarga'

const FORMATOS = {
  dinero: formatearDinero,
  numero: (n) => Number(n).toLocaleString('es-CO'),
}

// Tarjetas con el período elegido y su comparación con el período anterior (rango visible). Sin props extra son las
// cinco del admin; el panel del barbero pasa sus cuatro `indicadores`, su `obtener` y un `mensajeVacio`.
const COLUMNAS = { 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

const PanelIndicadores = ({ token, periodo, obtener = obtenerEstadisticas, indicadores = INDICADORES, mensajeVacio }) => {
  const { datos, cargando, error, recargar } = useCarga(() => obtener(token, periodo), periodo)
  const { comparacion } = PERIODOS.find((p) => p.id === periodo)

  if (error) {
    return (
      <section aria-labelledby="titulo-indicadores" className="rounded-xl border border-white/10 bg-zinc-950">
        <h2 id="titulo-indicadores" className="sr-only">Indicadores</h2>
        <ErrorCarga mensaje="No pudimos cargar los indicadores." onReintentar={recargar} variante="oscuro" />
      </section>
    )
  }

  return (
    <section aria-labelledby="titulo-indicadores" aria-busy={cargando} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="titulo-indicadores" className="text-lg font-semibold">
          Indicadores
          {datos && <span className="font-normal text-zinc-400"> · {formatearRango(datos.periodo)}</span>}
        </h2>
        {datos && (
          <p className="text-sm text-zinc-400">
            Comparado con {comparacion} ({formatearRango(datos.anterior)})
          </p>
        )}
      </div>

      {!datos ? (
        <p role="status" className="rounded-xl border border-white/10 bg-zinc-950 p-6 text-zinc-400">
          Cargando indicadores...
        </p>
      ) : (
        <div className={`grid grid-cols-2 gap-3 ${COLUMNAS[indicadores.length]}`}>
          {indicadores.map(({ clave, etiqueta, formato, invertir }, i) => (
            <TarjetaIndicador
              key={clave}
              etiqueta={etiqueta}
              valor={FORMATOS[formato](datos.actual[clave])}
              actual={datos.actual[clave]}
              previo={datos.previo[clave]}
              invertir={invertir}
              className={i === indicadores.length - 1 && indicadores.length % 2 === 1 ? 'col-span-2 lg:col-span-1' : ''}
            />
          ))}
        </div>
      )}
      {datos && mensajeVacio && datos.actual.completadas === 0 && (
        <p className="text-sm text-zinc-400">{mensajeVacio}</p>
      )}
    </section>
  )
}

export default PanelIndicadores
