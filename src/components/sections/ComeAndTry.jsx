import React, { useState } from 'react'
import ButtonReserva from '../ui/ButtonReserva'
import { GiBeard } from "react-icons/gi";
import { FaGlassMartiniAlt } from "react-icons/fa";
import { IoGameController } from "react-icons/io5";


const ComeAndTry = () => {
  return (
    <>
        <div className='grid md:grid-cols-2 justify-center items-star p-10  text-black z-10 bg-linear-to-br from-[#111111] via-[#1a1a1a] to-black md:h-150'>
            <div className='flex items-center justify-center gap-3 md:pb-12'>
                <div className='md:mx-12 '>
                    <img className='size-100 rounded-xl' src="https://images.unsplash.com/photo-1635273051937-a0ddef9573b6?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Manue" />
                </div>
                <div className='md:mx-12'>
                    <img className='size-100  lg:relative top-25 right-40 rounded-xl' src="https://images.unsplash.com/photo-1598524374912-6b0b0bab43dd?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Alan" />
                </div>
            </div>

            <div className='z-10 gap-3 flex flex-col text-white justify-center'>
                <h1 className='font-semibold tracking-wide text-xl'>COME AND TRY</h1>
                <h2 className='text-4xl md:text-6xl font-semibold tracking-wide'>Somos expertos en el cuidado del hombre</h2>
                <p className='text-xl tracking-wide'>Ven y sorprendente de cada detalle que tenemos preparado para ti, cada momento junto a nosotros es único.</p>
                <ul className='flex flex-col'>
                    <li className='flex items-center gap-1 text-xl'><GiBeard className='text-[#c5a54b]'/> Profesionales a tu servicio.</li>
                    <li className='flex items-center gap-1 text-xl'><FaGlassMartiniAlt className='text-[#0C2E94]'/> Bebidas incluidas en la experiencia.</li>
                    <li className='flex items-center gap-1 text-xl'><IoGameController className='text-[#D91F11]'/> Juegos y espacios para divertirse.</li>
                </ul>
                <ButtonReserva/>
            </div>

            
        </div>  
    </>
  )
}

export default ComeAndTry
