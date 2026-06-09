import React from 'react'
import { useNavigate } from 'react-router'

const NuestrosServicos = () => {
    const navigate = useNavigate()
  return (
    <>
    <div className='flex flex-col justify-center items-center p-20 gap-10 bg-cover bg-no-repeat bg-center'
    style={{
        backgroundImage:"url('https://images.unsplash.com/photo-1599351431613-18ef1fdd27e1?q=80&w=688&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')"
    }}>
        <div className='flex flex-col justify-center items-center'>
            <p className='text-4xl text-white lg:text-9xl'>Conoce Todos Nuestros</p>
            <p className='text-4xl text-white lg:text-9xl'>Servicios y Precios</p>
        </div>
        
        <button 
        onClick={()=> navigate("/cortes")}
        className='rounded-xl border bg-red-500 p-2 text-white hover:bg-amber-200 hover:text-black cursor-pointer active:scale-95 duration-300' >Mas Información</button>
    </div>
    </>
  )
}

export default NuestrosServicos
