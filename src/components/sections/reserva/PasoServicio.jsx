import { useFiltroServicios } from '../../../hooks/useFiltroServicios'
import FiltrosServicios from '../../ui/FiltrosServicios'
import SinResultados from '../../ui/SinResultados'
import { TarjetaServicioSeleccionable } from '../../ui/TarjetaServicio'
import { MAX_SERVICIOS, estadoDeTarjeta } from '../../../utils/carrito'
import { esAsesoria } from '../../../utils/reservaAsesoria'
import BloqueAsesoria from './BloqueAsesoria'

// Paso 1: reutiliza los mismos filtros, grupos y tarjeta que el catálogo, y permite elegir hasta MAX_SERVICIOS servicios
// con las mismas reglas del carrito (utils/carrito.js): máximo 3, tope de duración solo para combos y aviso suave de
// categoría repetida. Un servicio elegido que queda fuera del filtro actual sigue seleccionado (el resumen lo muestra);
// aquí solo no aparece su tarjeta. `onSeleccionar` recibe la lista nueva de ids, en orden.
// `asesorias` (opcional, etiquetadas con area 'asesoria'): añade el bloque "Añadir una asesoría" (una sola por reserva,
// dentro del mismo tope de 3 servicios). El tope de duración de los combos cuenta solo los servicios de barbería.
const PasoServicio = ({ servicios, asesorias = [], idsSeleccionados, onSeleccionar, enfocarAsesoria = false }) => {
  const filtro = useFiltroServicios(servicios, { servicioId: idsSeleccionados[0] })
  const catalogo = [...servicios, ...asesorias]
  const seleccion = idsSeleccionados.map((id) => catalogo.find((servicio) => servicio.id === id)).filter(Boolean)
  const seleccionBarberia = seleccion.filter((servicio) => !esAsesoria(servicio))
  const cantidadBarberia = idsSeleccionados.length - seleccion.filter(esAsesoria).length

  if (servicios.length === 0 && asesorias.length === 0) {
    return <p className="text-center font-poppins text-zinc-500">No hay servicios disponibles por ahora.</p>
  }

  // Con varias categorías a la vista cada una lleva su encabezado; con una sola no hace falta.
  const conEncabezados = filtro.grupos.length > 1

  // Hasta 3 servicios en total: la asesoría y los de barbería comparten el tope.
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

      {asesorias.length > 0 && (
        <BloqueAsesoria
          asesorias={asesorias}
          seleccion={seleccion}
          ids={idsSeleccionados}
          onAlternar={alternar}
          enfocar={enfocarAsesoria}
        />
      )}

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
                  const { seleccionado, bloqueado, ayuda } = estadoDeTarjeta(
                    seleccionBarberia,
                    servicio,
                    idsSeleccionados,
                    cantidadBarberia
                  )
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
