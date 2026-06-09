import React from 'react'
import { Swiper,SwiperSlide } from 'swiper/react'
import {Pagination,Autoplay } from 'swiper/modules'
import { useRef } from "react";
import { IoIosArrowForward } from "react-icons/io";
import { IoIosArrowBack } from "react-icons/io";

import "swiper/css";
import "swiper/css/pagination";

import { colaboradores } from '../../data/barberos';


const NuestrosColaboradores = () => {
    const swiperRef = useRef(null);
  return (
    <>
    <section className="py-20 bg-linear-to-tl from-gray-500 to-gray-900">
        <h2 className="text-5xl lg:text-7xl font-bold text-center text-white mb-12">
            Nuestro Equipo
        </h2>

  <div className="max-w-6xl mx-auto px-2 relative">

    <IoIosArrowBack size={50} 
      className='hidden md:block absolute left-8 top-1/2 -translate-y-1/2 z-50 bg-white rounded-full p-2 text-gray-700 cursor-pointer active:scale-95 transition duration-300'
      onClick={() => {
        console.log(swiperRef.current);
        swiperRef.current?.slidePrev();
    }}/>
    <IoIosArrowForward size={50} 
      className='hidden md:block absolute right-8 top-1/2 -translate-y-1/2 z-50 bg-white rounded-full p-2 text-gray-700 cursor-pointer active:scale-95 transition duration-300'
      onClick={() => swiperRef.current?.slideNext()}
    />

    <Swiper
        modules={[Pagination, Autoplay]}
        onSwiper={(swiper) => {
            swiperRef.current = swiper;
        }}
        slidesPerView={"auto"}
        centeredSlides={true}
        spaceBetween={30}
        loop={true}
        pagination={{ clickable: true }}
    >
      {colaboradores.map((persona) => (
        <SwiperSlide
          key={persona.id}
          className="w-75! md:w-87.5!"
        >
          <div className="bg-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <img
              src={persona.image}
              alt={persona.nombre}
              className="w-full h-72 object-cover"
            />

            <div className="p-8 text-center">
              <h3 className="text-2xl text-white font-semibold">
                {persona.nombre}
              </h3>

              <p className="text-gray-400 mt-2">
                {persona.cargo}
              </p>

              <p className="text-gray-400 mt-2">
                {persona.especialidad}
              </p>

              <p className="text-gray-400 mt-2">
                {persona.experiencia}
              </p>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  </div>
</section>
    </>
  )
}

export default NuestrosColaboradores
