import React from 'react'
import ButtonReserva from '../ui/ButtonReserva'
import { IoCut } from "react-icons/io5";
import { IoIosStarOutline } from "react-icons/io";
import { GiMagicBroom } from "react-icons/gi";
import { MdFaceRetouchingNatural } from "react-icons/md";
import { FaFaceGrinStars } from "react-icons/fa6";
import { GiBeard } from "react-icons/gi";

const Promos = () => {
  return (
    <div className='grid lg:grid-cols-2 border-gray-600 border-b'>
      <div className='realtive w-full h-full bg-cover bg-center border-gray-600 border-r'
      style={{
        backgroundImage:"url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=1200')"
      }}>
        <div className='relative z-10 text-white p-10 flex flex-col justify-center h-full'>
          <p className='text-[#d4af37] font-bold text-xl mb-6 lg:text-white'>
            Barberia de Autor - Bogota
          </p>
          <h1 className='text-6xl font-bold leading-tight max-w-xl '>
            "No es solo un corte.
            Es tu firma"
          </h1>

          <ButtonReserva/>
        </div>
      </div>
        {/*Cards de las promociones de la semana*/}

        <div className='relative bg-cover bg-no-repeat bg-center py-15 backdrop-blur-md border-gray-800 border-t'
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=1200')"
        }}>

        <div className='absolute inset-0 bg-black/70 backdrop-blur-[2px]'/>
        <h1 className='flex items-center justify-center text-5xl text-white my-5 md:text-6xl font-bold z-10 relative px-10'>Promociones de la semana</h1>
        <div className='md:grid-cols-2 2xl:grid 2xl:grid-cols-2 gap-20 relative z-10'>
            
            {/*Izquierda */}
            <div className='flex flex-col justify-center items-center'>
              <div className='border border-gray-500 shadow-xl flex items-center m-3 rounded-xl w-90 h-14 gap-2 bg-[#f7f4ef] hover:cursor-pointer backdrop-blur-md hover:scale-105 duration-300 '>
                <IoCut className='ml-4 rotate-270' size={25} />
                <div className='flex flex-col items-center'>
                  <h1 className='text-black font-semibold'>Corte Clasico</h1>
                  <p className='text-gray-500'>Desde $25.000</p>
                </div>
                <div className='absolute'>
                  <p className='relative -right-70'>35 min</p>
                </div>
              </div>

              <div className='border border-gray-500 shadow-xl flex items-center m-3 rounded-xl w-90 h-14 gap-2 bg-[#f7f4ef] hover:cursor-pointer backdrop-blur-md hover:scale-105 duration-300 '>
                <GiMagicBroom className='ml-4 ' size={25} />
                <div>
                  <h1 className='text-black font-semibold'>Mullet moderno</h1>
                  <p className='text-gray-500'>Desde $40.000</p>
                </div>
                <div className='absolute'>
                  <p className='relative -right-70'>50 min</p>
                </div>
              </div>

              <div className='border border-gray-500 shadow-xl flex items-center m-3 rounded-xl w-90 h-14 gap-2 bg-[#1c1c1c] hover:cursor-pointer backdrop-blur-md hover:scale-105 duration-300 '>
                <IoIosStarOutline className='ml-4 text-yellow-500' size={25} />
                <div>
                  <h1 className='text-white font-bold'>Corte premium</h1>
                  <p className='text-gray-500'>Desde $100.000</p>
                </div>
                <div className='absolute'>
                  <p className='relative -right-70 text-[#d4af37] font-semibold'>90 min</p>
                </div>
              </div>
            </div>
            {/*Derecha */}
            <div className='flex flex-col justify-center items-center'>
              <div className='border border-gray-500 shadow-xl flex items-center m-3 rounded-xl w-90 h-14 gap-2 bg-[#f7f4ef] hover:cursor-pointer backdrop-blur-md hover:scale-105 duration-300 '>
                <FaFaceGrinStars className='ml-4 ' size={25} />
                <div>
                  <h1 className='text-black font-semibold'>Exfoliación facil</h1>
                  <p className='text-gray-500'>Desde $20.000</p>
                </div>
                <div className='absolute'>
                  <p className='relative -right-70'>30 min</p>
                </div>
              </div>

              <div className='border border-gray-500 shadow-xl flex items-center m-3 rounded-xl w-90 h-14 gap-2 bg-[#f7f4ef] hover:cursor-pointer backdrop-blur-md hover:scale-105 duration-300 '>
                <GiBeard className='ml-4 ' size={25} />
                <div>
                  <h1 className='text-black font-semibold'>Barba premium</h1>
                  <p className='text-gray-500'>Desde $35.000 </p>
                </div>
                <div className='absolute'>
                  <p className='relative -right-70'>45 min</p>
                </div>
              </div>
              <div className='border border-gray-500 shadow-xl flex items-center m-3 rounded-xl w-90 h-14 gap-2 bg-[#1c1c1c] hover:cursor-pointer backdrop-blur-md hover:scale-105 duration-300 '>
                <MdFaceRetouchingNatural className='ml-4 text-yellow-500' size={25} />
                <div>
                  <h1 className='text-white font-bold'> Keratina masculina</h1>
                  <p className='text-gray-500'>Desde $150.000</p>
                </div>
                <div className='absolute'>
                  <p className='relative -right-70 text-[#d4af37] font-semibold'>2 horas</p>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
      
  )
}

export default Promos
