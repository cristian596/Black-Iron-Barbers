import { useState } from 'react'
import { obtenerIngresos } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import GraficoIngresos from './GraficoIngresos'
import ErrorCarga from '../ui/ErrorCarga'
import SinResultados from '../ui/SinResultados'

const AGRUPACIONES = [
  { id: 'dia', etiqueta: 'Por día', descripcion: 'Últimos 30 días' },
  { id: 'mes', etiqueta: 'Por mes', descripcion: 'Últimos 12 meses' },
]

const hayDatos = (datos) => [...datos.puntos, ...datos.anteriores].some((p) => p.ingresos > 0)

const PanelIngresos = ({ token, obtener = obtenerIngresos, className = '' }) => {
  const [agrupar, setAgrupar] = useState('dia')
  const { datos, cargando, error, recargar } = useCarga(() => obtener(token, agrupar), agrupar)
  const { descripcion } = AGRUPACIONES.find((a) => a.id === agrupar)
  // Al cambiar de agrupación hasta que llega la nueva respuesta, los datos viejos no corresponden.
  const vigente = datos && datos.agrupar === agrupar

  return (
    <section
      aria-labelledby="titulo-ingresos"
      aria-busy={cargando}
      className={`min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 ${className}`}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="titulo-ingresos" className="text-lg font-semibold">Ingresos</h2>
          <p className="text-sm text-zinc-400">{descripcion}, comparado con el período anterior</p>
        </div>
        <div role="group" aria-label="Agrupar ingresos" className="flex gap-2">
          {AGRUPACIONES.map(({ id, etiqueta }) => (
            <button
              key={id}
              type="button"
              aria-pressed={agrupar === id}
              onClick={() => setAgrupar(id)}
              className={`min-h-11 cursor-pointer rounded-lg border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-oro motion-safe:transition-colors motion-safe:duration-200 ${
                agrupar === id
                  ? 'border-oro bg-oro text-black'
                  : 'border-white/15 text-zinc-300 hover:border-white/40 hover:text-white'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorCarga mensaje="No pudimos cargar los ingresos." onReintentar={recargar} variante="oscuro" />
      ) : !vigente ? (
        <p role="status" className="py-16 text-center text-zinc-400">Cargando ingresos...</p>
      ) : !hayDatos(datos) ? (
        <SinResultados variante="oscuro" mensaje="Todavía no hay ingresos en este rango." />
      ) : (
        <GraficoIngresos key={agrupar} agrupar={agrupar} puntos={datos.puntos} anteriores={datos.anteriores} />
      )}
    </section>
  )
}

export default PanelIngresos
