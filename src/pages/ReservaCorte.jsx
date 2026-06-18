import React, { useState } from 'react'
import { serviciosMale } from '../data/serviciosMale'
import { serviciosFemale } from '../data/serviciosFemale'
import {colaboradores} from '../data/barberos'
import { horarios } from '../data/horarios'

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
        <div className='  p-4'>
          <div className='flex flex-col'>
            <label htmlFor="">Cliente</label>
            <input onChange={(e)=>setCliente(e.target.value)} type="text" placeholder='Escribe tu nombre' className='w-120 p-1 border'/>
          </div>

          <div className='flex flex-col'>
            <label htmlFor="">Correo Electronico</label>
            <input type="email" required placeholder='Example@gmail.com' className='w-120 p-1 border'/>
          </div>

          <div className='flex flex-col'>
            <label htmlFor="">Servicios Masculinos</label>
            <div className='flex gap-2'>
              {serviciosMale.map((serviM)=>{
                return(
                  <button
                  type='button'
                  key={serviM}
                  onClick={(e)=>setServicio(serviM)}
                  className={`border p-2 rounded-xl cursor-pointer active:scale-95 duration-300`}
                  >
                    {serviM}
                  </button>
                )
              })

              }
            </div>
          </div>

          <div className='flex flex-col'>
            <label htmlFor="">Servicios Femenino</label>
            <div className='grid lg:grid-cols-5 gap-2'>
              {serviciosFemale.map((serviF)=>{
                return(
                  <button
                  type='button'
                  key={serviF}
                  onClick={(e)=>setServicio(serviF)}
                  className={`border p-2 rounded-xl cursor-pointer active:scale-95 duration-300`}
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
                <label htmlFor="">Elige tu Barbero</label>
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
                <label htmlFor="">Seleccione la fecha para agendar su servicio</label>
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
                <label htmlFor="">Seleccione la hora de su servicio</label>
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