import { useNavigate } from 'react-router-dom'
import { ImScissors } from 'react-icons/im'
import { FaUserTie } from 'react-icons/fa6'

const ReservaATuManera = () => {
  const navigate = useNavigate()

  return (
    <div className='bg-[#0f0f0f] text-white py-14 px-5'>
      <h2 className='text-center text-3xl md:text-5xl font-bold font-cinzel mb-10'>
        Reserva a tu manera
      </h2>

      <div className='grid gap-6 md:grid-cols-2 max-w-4xl mx-auto'>
        <button
          type='button'
          onClick={() => navigate('/cortes')}
          className='flex flex-col items-center gap-3 border border-gray-700 rounded-2xl p-8 hover:border-[#D4AF37] hover:bg-[#1a1a1a] cursor-pointer active:scale-95 duration-300'
        >
          <ImScissors size={40} className='text-[#D4AF37]' />
          <h3 className='text-2xl font-semibold font-cinzel'>Por servicio</h3>
          <p className='text-gray-400 font-poppins'>
            Elige el corte, la barba o el combo que quieres y agenda directo con ese servicio ya seleccionado.
          </p>
        </button>

        <button
          type='button'
          onClick={() => navigate('/#equipo')}
          className='flex flex-col items-center gap-3 border border-gray-700 rounded-2xl p-8 hover:border-[#D4AF37] hover:bg-[#1a1a1a] cursor-pointer active:scale-95 duration-300'
        >
          <FaUserTie size={40} className='text-[#D4AF37]' />
          <h3 className='text-2xl font-semibold font-cinzel'>Por barbero</h3>
          <p className='text-gray-400 font-poppins'>
            Elige a tu barbero de confianza desde nuestro equipo y agenda directo con él ya seleccionado.
          </p>
        </button>
      </div>
    </div>
  )
}

export default ReservaATuManera
