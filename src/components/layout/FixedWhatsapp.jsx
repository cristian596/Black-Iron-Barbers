import React, { useState } from 'react'
import logo from '../../assets/img/logo.png'
import { FaWhatsapp } from "react-icons/fa";
import { IoCloseOutline } from "react-icons/io5";

const FixedWhatsapp = () => {
  const[showWhatsapp,setShowWhatsapp] = useState(false)

  return (
    <>
    <div className='fixed bottom-15 right-2 z-50'>
      {/*Modal */}
      <div className={`bg-white 
      absolute bottom-20 right-0
      w-87.5
      rounded-3xl
      shadow-2xl
      overflow-hidden
      transition-all duration-300
      ${
        showWhatsapp
        ? 'opacity-100 scale-100'
        :'opacity-0 scale-95 pointer-events-none'
      }`}>
          <div className='flex flex-col'>
            <div className='bg-green-400 flex justify-between gap-2 p-3 items-center'>
              <img src={logo} alt="logo" className='w-11 h-14 rounded-2xl'/>
              <p>¡Hola bienvenid@ a Black Iron Barbers!</p>
            </div>
            <div className='p-3 flex justify-center flex-col gap-3'>
              <p className='text-xl font-semibold'>Si quieres una accesoria personalizada...</p>
              <form action="">
                <label htmlFor=""> Nombres</label><br />
                <input type="text" placeholder='Javier Myllei' required className='border border-gray-600 rounded-xl p-1 w-xs'/><br />
                <label htmlFor=""> Correo Electronico</label><br />
                <input type="email" placeholder='Example@gmail.com' required className='border border-gray-600 rounded-xl p-1 w-xs'/><br />
                <label htmlFor=""> Telefono</label><br />
                <input type="tel" placeholder='Numero telefonico' className='border border-gray-600 rounded-xl p-1'/><br />
                <label htmlFor="Condiciones" className='flex gap-2 items-center'>
                  <input type="checkbox" name="terminos" id="Condiciones"/>
                Acepto llamadas y/o mensajes por whatsapp.
                </label>
                <button type='submit' className='border p-1 mt-3 w-22 flex justify-center cursor-pointer hover:bg-blue-600 hover:text-white active:scale-95 duration-300'>Enviar</button>
              </form>
            </div>
        </div>
      </div>
      {/*Button */}
      <button 
      onClick={()=>(setShowWhatsapp(!showWhatsapp))}
      className='bg-[#25D366] text-white rounded-full p-2 m-2 shadow-2xl hover:scale-110 transition-all duration-300 active:scale-95'>
        {
          showWhatsapp 
          ? <IoCloseOutline size={36}/>
          : <FaWhatsapp size={36}/>
        }
      </button>

    </div>

    </>
  )
}

export default FixedWhatsapp
