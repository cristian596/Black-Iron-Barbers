import { obtenerServiciosTop } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { PERIODOS } from '../../data/periodos'
import GraficoServiciosTop from './GraficoServiciosTop'
import ErrorCarga from '../ui/ErrorCarga'
import SinResultados from '../ui/SinResultados'

const LIMITE = 5

// Servicios más pedidos del período elegido; solo cuenta citas completadas.
const PanelServiciosTop = ({ token, periodo, className = '' }) => {
  const { datos, cargando, error, recargar } = useCarga(
    () => obtenerServiciosTop(token, periodo, LIMITE),
    periodo
  )
  const { etiqueta } = PERIODOS.find((p) => p.id === periodo)
  const vigente = datos && datos.periodo.clave === periodo

  return (
    <section
      aria-labelledby="titulo-servicios-top"
      aria-busy={cargando}
      className={`min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 ${className}`}
    >
      <h2 id="titulo-servicios-top" className="text-lg font-semibold">Servicios más pedidos</h2>
      <p className="mb-3 text-sm text-zinc-400">Citas completadas · {etiqueta}</p>

      {error ? (
        <ErrorCarga mensaje="No pudimos cargar los servicios." onReintentar={recargar} variante="oscuro" />
      ) : !vigente ? (
        <p role="status" className="py-10 text-center text-zinc-400">Cargando servicios...</p>
      ) : datos.servicios.length === 0 ? (
        <SinResultados variante="oscuro" mensaje="Aún no hay servicios completados en este período." />
      ) : (
        <GraficoServiciosTop servicios={datos.servicios} />
      )}
    </section>
  )
}

export default PanelServiciosTop
