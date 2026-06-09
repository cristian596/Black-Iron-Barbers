import React from 'react'
import { TbCup } from "react-icons/tb";
import { GiStarFormation } from "react-icons/gi";
import { FaArrowRight } from "react-icons/fa6";
import { useNavigate } from 'react-router';

const Descripcion = () => {
    const navigate = useNavigate()
  return (
    <>
    <div className='relative bg-cover bg-center bg-no-repeat'
    style={{
        backgroundImage:"url('https://images.unsplash.com/photo-1597299407241-638aa26e56c6?q=80&w=1157&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')"
    }}>
        <div className='absolute inset-0 bg-black/70 backdrop-blur-[1px]'/>
            <div className='grid md:grid-cols-2 px-6 py-2'>
                <div className='z-10 flex flex-col justify-center items-center'>
                    <h1 className='text-white text-3xl font-semibold md:text-5xl md: justify-between'>Black Iron Barber</h1>
                    <div className='text-white grid grid-cols-2 gap-6'>
                        <div className='py-4 group cursor-pointer'>
                            <TbCup size={120} className='text-[#D4AF37]'/>
                            <p className='text-xl py-2'>Bebidas con y sin alcohol que tendremos a tu servicio.</p>
                            <button
                            onClick={()=> navigate("/carta-bebidas")}
                             className='hidden md:flex items-center justify-center gap-1 group border border-white cursor-pointer duration-300 rounded-xl px-2 py-1 font-bold active:scale-95 hover:text-[#D4AF37] hover:border-[#D4AF37]'>
                                <span 
                                onClick={()=> navigate("/carta-bebidas")}
                                className='ml-0 w-0 overflow-hidden opacity-0  duration-300 group-hover:w-16 group-hover:opacity-100 group-hover:ml-1'>
                                    Carta
                                </span>
                                <FaArrowRight />
                            </button>
                            <button className='border border-white  w-20 rounded-2xl hover:text-[#D4AF37] hover:border-[#D4AF37] cursor-pointer active:scale-95 duration-300 md:hidden'>
                                <span  
                                onClick={()=> navigate("/carta-bebidas")} 
                                className='flex justify-center items-center gap-1 font-bold p-1'>Carta <FaArrowRight className='font-bold'/></span>
                            </button>
                        </div>
                        <div className='py-4 group cursor-pointer'>
                            <GiStarFormation size={120} className='text-[#D4AF37]'/>
                            <p className='text-xl py-2'>Atencion especializada profesional.</p>
                            <button
                            
                            className='hidden md:flex items-center justify-center gap-1 group border border-white cursor-pointer duration-300 rounded-xl px-2 py-1 font-bold active:scale-95 hover:text-[#D4AF37] hover:border-[#D4AF37]'>
                                <span 
                                onClick={()=> navigate("/reservar-corte")}
                                className='ml-0 w-0 overflow-hidden opacity-0  duration-300 group-hover:w-16 group-hover:opacity-100 group-hover:ml-1'>
                                    Reserva
                                </span>
                                <FaArrowRight />
                            </button>
                            <button 
                            className='border border-white  w-25 rounded-2xl hover:text-[#D4AF37] hover:border-[#D4AF37] cursor-pointer active:scale-95 duration-300 md:hidden'>
                                <span 
                                onClick={()=> navigate("/reservar-corte")}
                                className='flex justify-center items-center gap-1 font-bold p-1'>Reserva <FaArrowRight className='font-bold'/></span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className='z-10 flex justify-center items-center lg:px-24' >
                    <p className='text-white lg:text-xl'>Es un espacio donde el tiempo se detiene, el ruido de la ciudad desaparece y cada detalle — desde la música hasta el aroma del aceite de afeitar — está diseñado para una sola cosa: hacerte sentir en manos expertas.<br/>
                    Sillas de cuero negro, iluminación cálida, navajas de precisión y barberos que dominan su oficio con la misma seriedad con que un sastre corta un traje a medida. Aquí no hay prisa. Hay ritual.<br/>
                    Usamos únicamente productos de alta gama seleccionados por su rendimiento y su tacto. Porque tu piel y tu cabello merecen lo mejor, no lo más rápido.<br/>
                    <strong>Bienvenido al estándar que siempre mereciste.</strong></p>
                </div>
        </div>
    </div>
    </>
  )
}

export default Descripcion
