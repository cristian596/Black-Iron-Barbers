import { useMemo, useState } from 'react'
import { FcClock } from 'react-icons/fc'
import { MdAttachMoney } from 'react-icons/md'
import { obtenerDescripcion } from '../../../data/descripcionesServicios'
import { obtenerCategoria } from '../../../data/categoriasServicios'

// Con pocas categorías distintas, agrupar en pestañas solo añade clics sin ayudar a decidir.
const MINIMO_CATEGORIAS_PARA_TABS = 3
const TODOS = 'Todos'

const PasoServicio = ({ servicios, servicioIdSeleccionado, onSeleccionar }) => {
  const categorias = useMemo(
    () => Array.from(new Set(servicios.map((servicio) => obtenerCategoria(servicio)))),
    [servicios]
  )
  const usarTabs = categorias.length >= MINIMO_CATEGORIAS_PARA_TABS
  const [categoriaActiva, setCategoriaActiva] = useState(TODOS)

  const serviciosVisibles = useMemo(() => {
    if (!usarTabs || categoriaActiva === TODOS) return servicios
    return servicios.filter((servicio) => obtenerCategoria(servicio) === categoriaActiva)
  }, [servicios, usarTabs, categoriaActiva])

  if (servicios.length === 0) {
    return <p className="text-center font-poppins text-zinc-500">No hay servicios disponibles por ahora.</p>
  }

  return (
    <div>
      <h2 className="sr-only">Elige un servicio</h2>

      {usarTabs && (
        <div role="tablist" aria-label="Categorías de servicios" className="mb-5 flex flex-wrap justify-center gap-2">
          {[TODOS, ...categorias].map((categoria) => (
            <button
              key={categoria}
              type="button"
              role="tab"
              aria-selected={categoriaActiva === categoria}
              onClick={() => setCategoriaActiva(categoria)}
              className={`rounded-full border px-4 py-1.5 font-poppins text-sm font-semibold motion-safe:transition-colors motion-safe:duration-200 ${
                categoriaActiva === categoria
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-300 text-zinc-600 hover:border-black'
              }`}
            >
              {categoria}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {serviciosVisibles.map((servicio) => {
          const seleccionado = servicio.id === servicioIdSeleccionado

          return (
            <button
              key={servicio.id}
              type="button"
              aria-pressed={seleccionado}
              onClick={() => onSeleccionar(servicio.id)}
              className={`relative flex flex-col rounded-2xl border p-4 text-left shadow-sm motion-safe:transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                seleccionado ? 'border-[#D4AF37] bg-[#FFFBF0] ring-2 ring-[#D4AF37]' : 'border-zinc-300 bg-white'
              }`}
            >
              {seleccionado && (
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37] text-sm font-bold text-black"
                >
                  ✓
                </span>
              )}
              <span className="self-start rounded-full bg-black px-3 py-1 font-poppins text-xs font-semibold text-[#D4AF37]">
                {obtenerCategoria(servicio)}
              </span>
              <h3 className="mt-3 font-cinzel text-lg font-bold text-black">{servicio.nombre}</h3>
              <p className="mt-1 font-poppins text-sm text-zinc-600">{obtenerDescripcion(servicio)}</p>
              <p className="mt-4 flex items-center justify-between font-cinzel text-base font-semibold text-black">
                <span className="flex items-center gap-1">
                  <FcClock /> {servicio.duracion_min} min
                </span>
                <span className="flex items-center">
                  <MdAttachMoney size={20} />
                  {servicio.precio.toLocaleString('es-CO')}
                </span>
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default PasoServicio
