import { FcClock } from 'react-icons/fc'
import { useNavigate } from 'react-router-dom'
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

// Catálogo: el botón "Seleccionar" lleva a la reserva con ?servicio=<id>.
const TarjetaServicio = ({ servicio, Titulo = 'h3' }) => {
  const navigate = useNavigate()

  return (
    <div className='flex flex-col bg-white border border-gray-300 rounded-2xl p-4 shadow-md hover:shadow-xl hover:-translate-y-1 duration-300'>
      <ContenidoServicio servicio={servicio} Titulo={Titulo} />

      <button
        type='button'
        onClick={() => navigate(`/reservar-corte?servicio=${servicio.id}`)}
        className='mt-4 rounded-xl bg-oro text-black font-bold font-cinzel py-2 hover:bg-black hover:text-oro cursor-pointer active:scale-95 duration-300'
      >
        Seleccionar
      </button>
    </div>
  )
}

// Paso 1 de la reserva: toda la tarjeta es un botón de selección (aria-pressed), sin depender del Router.
export const TarjetaServicioSeleccionable = ({ servicio, Titulo = 'h3', seleccionado = false, onSeleccionar }) => (
  <button
    type='button'
    aria-pressed={seleccionado}
    onClick={() => onSeleccionar(servicio.id)}
    className={`flex min-w-0 flex-col rounded-2xl border p-4 text-left shadow-md hover:shadow-xl hover:-translate-y-1 duration-300 cursor-pointer ${
      seleccionado ? 'border-oro bg-[#FFFBF0] ring-2 ring-oro' : 'border-zinc-300 bg-white'
    }`}
  >
    <ContenidoServicio servicio={servicio} Titulo={Titulo} marcado={seleccionado} />
  </button>
)

export default TarjetaServicio
