import React, { useState } from 'react'
import { serviciosMale } from '../data/serviciosMale'
import { serviciosFemale } from '../data/serviciosFemale'
import {colaboradores} from '../data/barberos'
import { horarios } from '../data/horarios'
import { BiGame } from 'react-icons/bi'

const ReservaCorte = () => {
  const[cliente,setCliente] = useState("")
  const[correo,setCorreo] = useState("")
  const[servicio,setServicio] = useState("")
  const[barbero, setBarbero] = useState("")
  const[fecha,setFecha] = useState("")
  const[hora,setHora] = useState("")
  
  return (
    <>
    <div className='flex flex-col justify-center items-center'>
      <div className='flex flex-col justify-center items-center py-4'>
        <h1 className='text-5xl text-mauve-800 font-cinzel font-semibold'>
        Reserva tu Experiencia
        </h1>
        <p className='text-xl mt-4 text-mauve-600 font-cinzel font-semibold'>
          "Selecciona la hora, define tu estilo y permítenos encargarnos del resto." 
        </p>
      </div>
      
      <div className='py-2'>
        <div className=''>

          <div className='flex flex-col items-center justify-center'>
            <div className='flex flex-col'>
              <label htmlFor="" className='flex items-center justify-center font-poppins font-medium text-lg text-mauve-700 '>Cliente</label>
              <input onChange={(e)=>setCliente(e.target.value)} type="text" placeholder='Escribe tu nombre' className='w-120 rounded-lg p-1 border placeholder:text-gray-800'/>
            </div>

            <div className='flex flex-col mt-2'>
              <label htmlFor="" className='flex items-center justify-center font-poppins font-medium text-lg text-mauve-700 '>Correo Electronico</label>
              <input type="email" required placeholder='Example@gmail.com' className='w-120 p-1 border placeholder:text-gray-800 rounded-lg' />
            </div>
          </div>

          {/*Servicios masculinos */}

          <div className='flex flex-col mt-2'>
            <label htmlFor="" className='font-poppins font-medium text-lg text-mauve-700'>Servicios Masculinos</label>
            <div className='flex gap-2'>
              {serviciosMale.map((serviM)=>{
                return(
                  <button
                  type='button'
                  key={serviM}
                  onClick={(e)=>setServicio(serviM)}
                  className={`border border-gray-500 p-2 rounded-xl cursor-pointer active:scale-95 duration-300 hover:bg-mauve-300 ${
                    servicio === serviM 
                    ? "bg-mauve-400 border-black font-semibold"
                    : "bg-mauve-100"
                  }`}
                  >
                    {serviM}
                  </button>
                )
              })

              }
            </div>
          </div>

          {/*Servicios Femenino */}
          <div className='flex flex-col mt-2'>
            <label htmlFor="" className='font-poppins font-medium text-lg text-mauve-700'>Servicios Femenino</label>
            <div className='grid lg:grid-cols-5 gap-2'>
              {serviciosFemale.map((serviF)=>{
                return(
                  <button
                  type='button'
                  key={serviF}
                  onClick={(e)=>setServicio(serviF)}
                  className={`border border-gray-500 p-2 rounded-xl cursor-pointer active:scale-95 duration-300 hover:bg-indigo-200 ${
                    servicio === serviF
                    ? "bg-indigo-400 border-indigo-900 font-semibold"
                    : "bg-indigo-100"
                  }`}
                  >
                    {serviF}
                  </button>
                )
              })

              }
            </div>
          </div>

          <div>
            {servicio && (
              <div className='flex flex-col'>
                <label htmlFor="" className='font-poppins font-medium text-lg text-mauve-700'>Elige tu Barbero</label>
                <div className='grid grid-cols-6 gap-2'>
                  {colaboradores.map((barber)=>{
                    return(
                      <button
                      type='button'
                      key={barber.id}
                      onClick={()=> setBarbero(barber)}
                      className='flex flex-col border w-50'
                      >  
                      <h3>{barber.nombre}</h3>
                      <p>{barber.calificacion}</p>
                      <p>{barber.especialidad}</p>
                      </button>
                    )
                    })
                  }
                </div>
              </div>
          )}
          </div>
          
          <div>
            {barbero && (
              <div>
                <label htmlFor="" className='font-poppins font-medium text-lg text-mauve-700'>Seleccione la fecha para agendar su servicio</label>
                <div>
                  <input 
                  type="date" 
                  className='border'
                  value={fecha}
                  onChange={(e)=>setFecha(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            {fecha && (
              <div>
                <label htmlFor="" className='font-poppins font-medium text-lg text-mauve-700'>Seleccione la hora de su servicio</label>
                <div>
                  {horarios.map((horaSe)=>{
                    return(
                      <button
                      type='button'
                      value={horaSe}
                      onClick={(e)=>setHora(e.target.value)}
                      >
                        {horaSe}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            {hora && (
              <button>Agendar Cita!</button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default ReservaCorte