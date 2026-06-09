import React from 'react'
import { useNavigate } from 'react-router'

const FixedFooter = () => {
  const navigate = useNavigate()
  return (
    <>
    <div className='flex justify-center items-center bg-[#0f0f0f] gap-2 p-1 sticky bottom-0 z-50 w-full'>
        <h1 className='text-white font-semibold '>Vive la experiencia</h1>
        <button 
        onClick={()=> navigate("/reservar-corte")}
        className='border border-white text-black font-semibold bg-[#c5a54b] p-1 rounded-xl active:scale-95 duration-300 cursor-pointer'>Reservar</button>
    </div>
    </>
  )
}

export default FixedFooter
