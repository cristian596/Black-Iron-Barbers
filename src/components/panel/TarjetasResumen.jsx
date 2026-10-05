import TarjetaIndicador from '../admin/TarjetaIndicador'
import { formatearDinero, fechaLegible, soloHora } from '../../utils/formato'

// Las cuatro tarjetas del Resumen del barbero (todo es suyo: el back-end ya filtra por su barbero_id).
const TarjetasResumen = ({ resumen }) => {
  const { proxima_cita: proxima } = resumen
  return (
    <section aria-labelledby="titulo-cifras-barbero" className="min-w-0">
      <h2 id="titulo-cifras-barbero" className="sr-only">Cifras de hoy y del mes</h2>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador
          etiqueta="Citas hoy"
          valor={resumen.citas_hoy}
          nota={`${resumen.completadas_hoy} ${resumen.completadas_hoy === 1 ? 'completada' : 'completadas'}`}
        />
        <TarjetaIndicador etiqueta="Ingresos hoy" valor={formatearDinero(resumen.ingresos_hoy)} nota="De tus citas completadas" />
        <TarjetaIndicador
          etiqueta="Cortes del mes"
          valor={resumen.cortes_mes}
          nota={`${formatearDinero(resumen.ingresos_mes)} en ingresos`}
        />
        <TarjetaIndicador
          etiqueta="Próxima cita"
          valor={proxima ? soloHora(proxima.hora) : '—'}
          nota={
            proxima
              ? `${proxima.cliente} · ${proxima.servicio_nombre}${proxima.fecha !== resumen.fecha ? ` · ${fechaLegible(proxima.fecha)}` : ''}`
              : 'Sin citas próximas'
          }
        />
      </div>
    </section>
  )
}

export default TarjetasResumen
