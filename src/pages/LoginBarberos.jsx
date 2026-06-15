import React from 'react'

const LoginBarberos = () => {
  return (
    <>
    <div className='flex flex-col justify-center items-center  bg-[#000000]'>
        <img src="/Login/logo.jpg" alt="" className='flex justify-center items-center w-80 md:w-100'/>
        <div>
            <h1 className='p-5 flex justify-center font-bold text-5xl text-white mb-10'>Agenda Barberos</h1>
            <div >
                <form  className='flex flex-col justify-center gap-3'>
                    <div className='flex flex-col justify-center gap-3'> 
                        <input type="text" placeholder='Escribe tu usuario' className='border w-full p-3 bg-white rounded-xl placeholder-gray-700'/>
                    </div>

                    <div className='flex flex-col justify-center gap-3'>
                        <input type="password" placeholder='Contraseña' className='border w-full p-3 bg-white rounded-xl placeholder-gray-700'/>
                    </div>

                    <button className='w-full bg-amber-50 p-2 mt-4 mb-10 font-medium text-xl rounded-xl cursor-pointer active:scale-95 duration-500 hover:bg-amber-200 transition-colors'>Ingresar</button>
                </form>
            </div>
            
        </div>
    </div>
    </>
  )
}

export default LoginBarberos
