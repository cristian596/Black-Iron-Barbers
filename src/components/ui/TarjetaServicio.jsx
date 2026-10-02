import { FcClock } from 'react-icons/fc'
import { MdAttachMoney } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { obtenerDescripcion } from '../../data/descripcionesServicios'

const TarjetaServicio = ({ servicio, categoria }) => {
  const navigate = useNavigate()

  return (
    <div className='flex flex-col bg-white border border-gray-300 rounded-2xl p-4 shadow-md hover:shadow-xl hover:-translate-y-1 duration-300'>
      <span className='self-start rounded-full bg-black text-[#D4AF37] text-xs font-semibold px-3 py-1 font-poppins'>
        {categoria}
      </span>

      <h3 className='text-xl mt-3 font-bold font-cinzel'>{servicio.nombre}</h3>

      <p className='text-sm text-gray-600 mt-1 font-poppins'>
        {obtenerDescripcion(servicio)}
      </p>

      <p className='flex items-center justify-between mt-4 text-lg font-cinzel font-semibold'>
        <span className='flex items-center gap-1'>
          <FcClock />{servicio.duracion_min} min
        </span>
        <span className='flex items-center'>
          <MdAttachMoney size={24} />
          {servicio.precio.toLocaleString('es-CO')}
        </span>
      </p>

      <button
        type='button'
        onClick={() => navigate(`/reservar-corte?servicio=${servicio.id}`)}
        className='mt-4 rounded-xl bg-[#D4AF37] text-black font-bold font-cinzel py-2 hover:bg-black hover:text-[#D4AF37] cursor-pointer active:scale-95 duration-300'
      >
        Seleccionar
      </button>
    </div>
  )
}

export default TarjetaServicio
