import React from 'react'
import { useNavigate } from 'react-router'

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
    </>
  )
}

export default Agendarcita
