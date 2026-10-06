import { useFiltroServicios } from '../../../hooks/useFiltroServicios'
import FiltrosServicios from '../../ui/FiltrosServicios'
import SinResultados from '../../ui/SinResultados'
import { TarjetaServicioSeleccionable } from '../../ui/TarjetaServicio'
import { MAX_SERVICIOS, estadoDeTarjeta } from '../../../utils/carrito'

// Paso 1: reutiliza los mismos filtros, grupos y tarjeta que el catálogo, y permite elegir hasta MAX_SERVICIOS servicios
// con las mismas reglas del carrito (utils/carrito.js): máximo 3, tope de duración solo para combos y aviso suave de
// categoría repetida. Un servicio elegido que queda fuera del filtro actual sigue seleccionado (el resumen lo muestra);
// aquí solo no aparece su tarjeta. `onSeleccionar` recibe la lista nueva de ids, en orden.
const PasoServicio = ({ servicios, idsSeleccionados, onSeleccionar }) => {
  const filtro = useFiltroServicios(servicios, { servicioId: idsSeleccionados[0] })
  const seleccion = idsSeleccionados.map((id) => servicios.find((servicio) => servicio.id === id)).filter(Boolean)

  if (servicios.length === 0) {
    return <p className="text-center font-poppins text-zinc-500">No hay servicios disponibles por ahora.</p>
  }

  // Con varias categorías a la vista cada una lleva su encabezado; con una sola no hace falta.
  const conEncabezados = filtro.grupos.length > 1

  const alternar = (id) => {
    onSeleccionar(
      idsSeleccionados.includes(id) ? idsSeleccionados.filter((actual) => actual !== id) : [...idsSeleccionados, id]
    )
  }

  return (
    <div className="min-w-0">
      <h2 className="sr-only">Elige tus servicios</h2>
      <p className="mb-4 text-center font-poppins text-sm text-zinc-600">
        Elige hasta {MAX_SERVICIOS} servicios y los agendamos en una sola cita.
      </p>

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
                {grupo.servicios.map((servicio) => {
                  const { seleccionado, bloqueado, ayuda } = estadoDeTarjeta(seleccion, servicio, idsSeleccionados)
                  return (
                    <TarjetaServicioSeleccionable
                      key={servicio.id}
                      servicio={servicio}
                      Titulo={conEncabezados ? 'h4' : 'h3'}
                      seleccionado={seleccionado}
                      bloqueado={bloqueado}
                      ayuda={ayuda}
                      onSeleccionar={alternar}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default PasoServicio
