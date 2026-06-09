import React from 'react'
import { FaArrowRight } from "react-icons/fa";
import { Navigate, useNavigate } from 'react-router';

const ButtonReserva = () => {
  const navigate = useNavigate()
  return (
    <div className='flex my-5'>
      <button onClick={()=> navigate("/reservar-corte")} className='group flex items-center bg-white/70 border-2 border-black text-black rounded-full p-2 font-bold hover:cursor-pointer hover:scale-105 duration-300 active:scale-95'>
        <span className='overflow-hidden'>Reserva Tu Corte!</span>
        <span className='overflow-hidden m-0 opacity-0 transition-all duration-300 group-hover:w-4 group-hover:ml-2 group-hover:opacity-100'><FaArrowRight size={14}/></span>
      </button>
    </div>
  )
}

export default ButtonReserva
