import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, Autoplay } from 'swiper/modules'
import { useEffect, useRef, useState } from 'react'
import { IoIosArrowForward } from 'react-icons/io'
import { IoIosArrowBack } from 'react-icons/io'

import "swiper/css";
import "swiper/css/pagination";

import { obtenerBarberos } from '../../services/api'
import TarjetaBarbero from '../ui/TarjetaBarbero'
import Revelar from '../ui/Revelar'

const NuestrosColaboradores = () => {
  const swiperRef = useRef(null);
  const [barberos, setBarberos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargarBarberos = async () => {
      try {
        const data = await obtenerBarberos()
        setBarberos(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargarBarberos()
  }, [])

  return (
    <>
    <section id='equipo' className="py-20 bg-linear-to-tl from-gray-500 to-gray-900">
        <Revelar como='h2' className="text-5xl lg:text-7xl font-bold text-center text-white mb-12">
            Nuestro Equipo
        </Revelar>

        {cargando && (
          <p className='text-center text-white font-poppins text-xl'>Cargando barberos...</p>
        )}

        {error && (
          <p className='text-center text-white font-poppins text-xl'>{error}</p>
        )}

        {!cargando && !error && (
  <Revelar retraso={80} className="max-w-6xl mx-auto px-2 relative">

    <IoIosArrowBack size={50}
      className='hidden md:block absolute left-8 top-1/2 -translate-y-1/2 z-50 bg-white rounded-full p-2 text-gray-700 cursor-pointer active:scale-95 transition duration-300'
      onClick={() => {
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
      {barberos.map((barbero) => (
        <SwiperSlide
          key={barbero.id}
          className="w-75! md:w-87.5!"
        >
          <TarjetaBarbero barbero={barbero} />
        </SwiperSlide>
      ))}
    </Swiper>
  </Revelar>
        )}
</section>
    </>
  )
}

export default NuestrosColaboradores
