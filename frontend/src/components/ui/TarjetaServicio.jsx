import { FcClock } from 'react-icons/fc'
import { Link } from 'react-router-dom'
import { useId } from 'react'
import { useCarrito } from '../../context/CarritoContext'
import { enlaceReservaIndividual, estadoDeTarjeta } from '../../utils/carrito'
import InsigniaTipo from './InsigniaTipo'
import { formatearPrecio } from '../../utils/formato'
import { nombreCategoria } from '../../utils/servicios'

// Contenido común de la tarjeta (categoría, tipo, nombre, descripción, duración y precio).
// Titulo: nivel del encabezado del nombre (h4 cuando la lista lleva encabezados de categoría).
const ContenidoServicio = ({ servicio, Titulo, marcado = false }) => (
  <>
    <div className='flex w-full flex-wrap items-center justify-between gap-2'>
      <span className='font-poppins text-xs font-semibold uppercase tracking-wide text-zinc-500'>
        {nombreCategoria(servicio)}
      </span>
      <span className='flex items-center gap-2'>
        <InsigniaTipo tipo={servicio.tipo} />
        {marcado && (
          <span
            aria-hidden='true'
            className='flex h-6 w-6 items-center justify-center rounded-full bg-oro text-sm font-bold text-black'
          >
            ✓
          </span>
        )}
      </span>
    </div>

    <Titulo className='text-xl mt-3 font-bold font-cinzel'>{servicio.nombre}</Titulo>

    {servicio.descripcion && (
      <p className='text-sm text-gray-600 mt-1 font-poppins'>{servicio.descripcion}</p>
    )}

    <p className='flex w-full items-center justify-between mt-auto pt-4 text-lg font-cinzel font-semibold'>
      <span className='flex items-center gap-1'>
        <FcClock />{servicio.duracion_min} min
      </span>
      <span>{formatearPrecio(servicio.precio)}</span>
    </p>
  </>
)

// Catálogo: "Agregar a mi selección" suma el servicio al carrito (hasta 3) y "Reservar solo este" mantiene el camino
// rápido (?servicio=<id>) sin tocar el carrito. Si no se puede agregar (máximo de servicios o de duración del combo) el
// botón queda con aria-disabled —sigue enfocable— y el motivo se explica con texto visible enlazado con aria-describedby.
const TarjetaServicio = ({ servicio, Titulo = 'h3' }) => {
  const { ids, seleccion, alternar } = useCarrito()
  const idAyuda = useId()

  // ayuda: motivo del bloqueo o, si no bloquea, el aviso suave de que ya hay otro servicio de la misma categoría.
  const { seleccionado, bloqueado, ayuda } = estadoDeTarjeta(seleccion, servicio, ids)

  return (
    <div
      className={`flex flex-col rounded-2xl border p-4 shadow-md hover:shadow-xl hover:-translate-y-1 duration-300 ${
        seleccionado ? 'border-oro bg-[#FFFBF0] ring-2 ring-oro' : 'border-gray-300 bg-white'
      }`}
    >
      <ContenidoServicio servicio={servicio} Titulo={Titulo} marcado={seleccionado} />

      <button
        type='button'
        aria-pressed={seleccionado}
        aria-disabled={bloqueado || undefined}
        aria-describedby={ayuda ? idAyuda : undefined}
        onClick={() => {
          if (!bloqueado) alternar(servicio)
        }}
        className={`mt-4 min-h-11 rounded-xl px-3 py-2 font-cinzel font-bold active:scale-95 duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:scale-100 ${
          seleccionado ? 'bg-black text-oro hover:bg-zinc-800' : 'bg-oro text-black hover:bg-black hover:text-oro'
        } ${bloqueado ? 'hover:bg-oro hover:text-black' : 'cursor-pointer'}`}
      >
        {seleccionado ? 'Quitar de mi selección' : 'Agregar a mi selección'}
      </button>

      {ayuda && (
        <p id={idAyuda} className='mt-2 font-poppins text-xs font-medium text-zinc-700'>
          {ayuda}
        </p>
      )}

      <Link
        to={enlaceReservaIndividual(servicio.id)}
        className='mt-1 flex min-h-11 items-center justify-center rounded-xl px-3 font-poppins text-sm font-semibold text-zinc-800 underline underline-offset-4 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black'
      >
        Reservar solo este
      </Link>
    </div>
  )
}

// Paso 1 de la reserva: toda la tarjeta es un botón de selección (aria-pressed), sin depender del Router. Admite varias
// a la vez; si no se puede agregar (`bloqueado`) queda con aria-disabled —sigue enfocable— y `ayuda` explica el motivo
// con texto visible enlazado por aria-describedby (también sirve para el aviso suave de categoría repetida).
export const TarjetaServicioSeleccionable = ({
  servicio,
  Titulo = 'h3',
  seleccionado = false,
  bloqueado = false,
  ayuda = null,
  onSeleccionar,
}) => {
  const idAyuda = useId()

  return (
    <div className='flex min-w-0 flex-col'>
      <button
        type='button'
        aria-pressed={seleccionado}
        aria-disabled={bloqueado || undefined}
        aria-describedby={ayuda ? idAyuda : undefined}
        onClick={() => {
          if (!bloqueado) onSeleccionar(servicio.id)
        }}
        className={`flex min-w-0 flex-1 flex-col rounded-2xl border p-4 text-left shadow-md duration-300 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${
          bloqueado ? '' : 'cursor-pointer hover:shadow-xl hover:-translate-y-1'
        } ${seleccionado ? 'border-oro bg-[#FFFBF0] ring-2 ring-oro' : 'border-zinc-300 bg-white'}`}
      >
        <ContenidoServicio servicio={servicio} Titulo={Titulo} marcado={seleccionado} />
      </button>
      {ayuda && (
        <p id={idAyuda} className='mt-2 px-1 font-poppins text-xs font-medium text-zinc-700'>
          {ayuda}
        </p>
      )}
    </div>
  )
}

export default TarjetaServicio
