import { useNavigate } from 'react-router-dom'
import AvatarBarbero from './AvatarBarbero'

const TarjetaBarbero = ({ barbero }) => {
  const navigate = useNavigate()

  return (
    <div className='bg-zinc-800 rounded-xl overflow-hidden shadow-lg'>
      <AvatarBarbero barbero={barbero} className='w-full h-72' textoClase='text-6xl' />

      <div className='p-8 text-center'>
        <h3 className='text-2xl text-white font-semibold'>{barbero.nombre}</h3>
        <p className='text-gray-400 mt-2'>{barbero.cargo}</p>
        <p className='text-gray-400 mt-2'>{barbero.especialidad}</p>

        <button
          type='button'
          onClick={() => navigate(`/reservar-corte?barbero=${barbero.id}`)}
          className='mt-4 rounded-full border border-[#D4AF37] text-[#D4AF37] font-semibold px-5 py-2 hover:bg-[#D4AF37] hover:text-black cursor-pointer active:scale-95 duration-300'
        >
          Reservar con {barbero.nombre}
        </button>
      </div>
    </div>
  )
}

export default TarjetaBarbero
