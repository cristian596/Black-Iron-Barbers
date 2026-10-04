import { useFiltroServicios } from '../../../hooks/useFiltroServicios'
import FiltrosServicios from '../../ui/FiltrosServicios'
import SinResultados from '../../ui/SinResultados'
import { TarjetaServicioSeleccionable } from '../../ui/TarjetaServicio'

// Paso 1: reutiliza los mismos filtros, grupos y tarjeta que el catálogo. Si el servicio elegido queda
// fuera del filtro actual sigue seleccionado (el resumen lo muestra); aquí solo no aparece su tarjeta.
const PasoServicio = ({ servicios, servicioIdSeleccionado, onSeleccionar }) => {
  const filtro = useFiltroServicios(servicios, { servicioId: servicioIdSeleccionado })

  if (servicios.length === 0) {
    return <p className="text-center font-poppins text-zinc-500">No hay servicios disponibles por ahora.</p>
  }

  // Con varias categorías a la vista cada una lleva su encabezado; con una sola no hace falta.
  const conEncabezados = filtro.grupos.length > 1

  return (
    <div className="min-w-0">
      <h2 className="sr-only">Elige un servicio</h2>

      <FiltrosServicios filtro={filtro} conBusqueda variante="claro" />

      {filtro.visibles.length === 0 ? (
        <SinResultados onLimpiar={filtro.limpiar} variante="claro" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8">
          {filtro.grupos.map((grupo) => (
            <section key={grupo.slug} aria-label={grupo.nombre} className="min-w-0">
              {conEncabezados && (
                <h3 className="mb-3 font-cinzel text-xl font-bold text-black">{grupo.nombre}</h3>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {grupo.servicios.map((servicio) => (
                  <TarjetaServicioSeleccionable
                    key={servicio.id}
                    servicio={servicio}
                    Titulo={conEncabezados ? 'h4' : 'h3'}
                    seleccionado={servicio.id === servicioIdSeleccionado}
                    onSeleccionar={onSeleccionar}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default PasoServicio
