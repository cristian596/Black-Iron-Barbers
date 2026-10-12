import { useState } from 'react'
import { obtenerServiciosTop } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { PERIODOS } from '../../data/periodos'
import { AREA_ASESORIA, AREA_BARBERIA } from '../../utils/areas'
import GraficoServiciosTop from './GraficoServiciosTop'
import ErrorCarga from '../ui/ErrorCarga'
import SinResultados from '../ui/SinResultados'

const LIMITE = 5

const AREAS = [
  { id: AREA_BARBERIA, etiqueta: 'Barbería', vacio: 'Aún no hay servicios completados en este período.' },
  { id: AREA_ASESORIA, etiqueta: 'Asesorías', vacio: 'Aún no hay asesorías completadas en este período.' },
]

// Servicios más pedidos del período elegido; solo cuenta citas completadas. Con `conSelectorArea` (admin) se elige
// entre Barbería (por defecto) y Asesorías: no se mezclan en una sola lista. Sin él, como siempre (panel del barbero).
const PanelServiciosTop = ({ token, periodo, obtener = obtenerServiciosTop, conSelectorArea = false, className = '' }) => {
  const [area, setArea] = useState(AREA_BARBERIA)
  const { datos, cargando, error, recargar } = useCarga(
    () => (conSelectorArea ? obtener(token, periodo, LIMITE, area) : obtener(token, periodo, LIMITE)),
    `${periodo}|${conSelectorArea ? area : ''}`
  )
  const { etiqueta } = PERIODOS.find((p) => p.id === periodo)
  const vigente = datos && datos.periodo.clave === periodo && (!conSelectorArea || (datos.area ?? AREA_BARBERIA) === area)
  const actual = AREAS.find((a) => a.id === area)

  return (
    <section
      aria-labelledby="titulo-servicios-top"
      aria-busy={cargando}
      className={`min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 ${className}`}
    >
      <h2 id="titulo-servicios-top" className="text-lg font-semibold">Servicios más pedidos</h2>
      <p className="mb-3 text-sm text-zinc-400">
        {conSelectorArea ? `${actual.etiqueta} · ` : ''}Citas completadas · {etiqueta}
      </p>

      {conSelectorArea && (
        <div role="group" aria-label="Área de los servicios" className="mb-3 flex gap-2">
          {AREAS.map(({ id, etiqueta: texto }) => (
            <button
              key={id}
              type="button"
              aria-pressed={area === id}
              onClick={() => setArea(id)}
              className={`min-h-11 flex-1 cursor-pointer rounded-lg border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-oro motion-safe:transition-colors motion-safe:duration-200 sm:flex-none ${
                area === id
                  ? 'border-oro bg-oro text-black'
                  : 'border-white/15 text-zinc-300 hover:border-white/40 hover:text-white'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <ErrorCarga mensaje="No pudimos cargar los servicios." onReintentar={recargar} variante="oscuro" />
      ) : !vigente ? (
        <p role="status" className="py-10 text-center text-zinc-400">Cargando servicios...</p>
      ) : datos.servicios.length === 0 ? (
        <SinResultados variante="oscuro" mensaje={conSelectorArea ? actual.vacio : AREAS[0].vacio} />
      ) : (
        <GraficoServiciosTop servicios={datos.servicios} />
      )}
    </section>
  )
}

export default PanelServiciosTop
