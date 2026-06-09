import React from 'react'
import { FaMapMarkerAlt, FaPhoneAlt, FaClock } from "react-icons/fa";

const Ubicacion = () => {
  return (
    <>
    <div>
      <section className="bg-gray-200 py-10">
        <h2 className="font-bebas text-6xl text-center  lg:text-9xl ">
          Nuestra Ubicacion
        </h2>

        <div className="grid grid-cols-1  md:grid-cols-3 lg:grid-cols-3 mx-10">
          <div className='col-span-2 flex justify-center items-center'>
            <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d496.9842754271612!2d-74.33886523267991!3d4.791628559200309!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e3f7b8a668c478b%3A0x87fa05bd8ce20f9e!2sBarber%20Black%20And%20White!5e0!3m2!1ses-419!2sco!4v1780698068932!5m2!1ses-419!2sco" width="500" 
            height="450" 
            style={{border:0}} 
            allowfullscreen="" 
            loading="lazy" 
            referrerpolicy="no-referrer-when-downgrade"
            className="rounded-2xl shadow-xl lg:w-6xl lg:h-150"/>
          </div>
          <div className='flex flex-col justify-center gap-2 py-3 lg:gap-6 font-bebas'>
            <p className='flex items-center gap-1 text-2xl md:text-3xl'><FaMapMarkerAlt/>Direccion: Cll 21 #1 A 69 prado,sur Segundo piso</p>
            <p className='flex items-center gap-1 text-2xl md:text-3xl'><FaPhoneAlt/>Telefono: 3124567890</p>
            <p className='flex items-center gap-1 text-2xl md:text-3xl'><FaClock/>Horarios: 10:00 am a 9:00 pm </p>
          </div>
        </div>
      </section>
    </div>
    </>
  )
}

export default Ubicacion
