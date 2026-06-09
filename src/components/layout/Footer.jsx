import React from 'react'
import { FaFacebookF } from "react-icons/fa";
import { FaInstagram } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa";

const Footer = () => {
  return (
    <>
    <div className='bg-[#141414] text-white'>
      <div className='flex gap-2 p-2 flex-col'>
        <h1 className='flex justify-center text-3xl text-[#c5a54b]'>"No es solo un corte. Es tu firma."</h1>
        <div className='flex  justify-center items-center gap-10 cursor-pointer'>
          <FaFacebookF size={34} className='border p-1 rounded-xl border-gray-600 cursor-pointer active:scale-95 duration-200 active:text-white hover:text-blue-600 md:size-12'/>
          <FaInstagram size={34} className='border p-1 rounded-xl border-gray-600 cursor-pointer active:scale-95 duration-200 active:text-white hover:text-violet-600 md:size-12'/>
          <FaTiktok size={34} className='border p-1 rounded-xl border-gray-600 cursor-pointer active:scale-95 duration-200 active:text-white hover:text-pink-500 md:size-12'/>
        </div>
      </div>
      <hr className='text-[#c5a54b]/50'/>
      <div className='p-4 flex flex-col justify-center items-center text-gray-500 gap-3 lg:flex-row lg:gap-25'>
        <p className='text-2xl font-bold'>El corte cambia. La filosofía. nunca.</p>
        <p className='font-semibold'>&copy; 2026 Black Iron Barber -- Todos los derechos reservados</p>
      </div>
    </div>
    </>
  )
}

export default Footer
