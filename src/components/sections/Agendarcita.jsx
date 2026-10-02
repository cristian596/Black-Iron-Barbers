import { useNavigate } from 'react-router-dom'
import { FaStar } from 'react-icons/fa'
import { RESENAS } from '../../data/resenas'

const Agendarcita = () => {
  const navigate = useNavigate()
  return (
    <>
    <div className='bg-[#0f0f0f] md:grid grid-cols-2'>
      <div className='text-white flex flex-col justify-center items-center gap-2 p-4 border-gray-600 border'>
        <h1 className='text-gray-400 font-bold'>AGENDA TU CITA!</h1>
        <p className='font-bold text-xl'>Hoy - 3:30 PM - Modelia</p>
        <button
        onClick={()=> navigate("/reservar-corte")}
        className='border border-black font-semibold rounded-xl p-2 active:scale-90 duration-300 cursor-pointer bg-white text-black w-50'>
          Reservar Ahora
        </button>
      </div>

      <div className='text-white grid grid-cols-2 md:grid md:grid-cols-4 p-4 border-gray-600 gap-2 border'>
        <div className='flex  flex-col justify-center items-center'>
          <h1 className='text-2xl text-[#c5a54b] font-bold'>+6K</h1>
          <p className='text-2xl text-gray-500 md:text-xl lg:text-2xl'>CLIENTES</p>
        </div>
        <div className='flex  flex-col justify-center items-center'>
          <h1 className='text-2xl text-[#c5a54b] font-bold '>12</h1>
          <p className='text-2xl text-gray-500 md:text-xl lg:text-2xl'>BARBEROS</p>
        </div>
        <div className='flex  flex-col justify-center items-center'>
          <h1 className='text-2xl text-[#c5a54b] font-bold' >6</h1>
          <p className='text-2xl text-gray-500 md:text-xl lg:text-2xl'>AÑOS</p>
        </div>
        <div className='flex  flex-col justify-center items-center'>
          <h1 className='text-2xl text-[#c5a54b] font-bold'>2</h1>
          <p className='text-2xl text-gray-500 md:text-xl lg:text-2xl'>LOCALES</p>
        </div>
      </div>
    </div>

    <div className='bg-[#141414] py-10 px-5'>
      <h2 className='text-center text-white text-3xl md:text-4xl font-bold font-cinzel mb-8'>
        Lo que dicen nuestros clientes
      </h2>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto'>
        {RESENAS.map((resena) => (
          <div key={resena.id} className='bg-[#1a1a1a] border border-gray-700 rounded-xl p-5 flex flex-col gap-2'>
            <div className='flex gap-1' aria-hidden='true'>
              {Array.from({ length: 5 }, (_, i) => (
                <FaStar
                  key={i}
                  className={i < resena.calificacion ? 'text-[#D4AF37]' : 'text-gray-600'}
                />
              ))}
            </div>
            <span className='sr-only'>{resena.calificacion} de 5 estrellas</span>
            <p className='text-gray-300 font-poppins text-sm'>&ldquo;{resena.comentario}&rdquo;</p>
            <p className='text-white font-semibold font-poppins mt-auto'>{resena.nombre}</p>
          </div>
        ))}
      </div>
    </div>
    </>
  )
}

export default Agendarcita
