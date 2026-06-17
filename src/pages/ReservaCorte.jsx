import React, { useState } from 'react'
import { serviciosMale } from '../data/serviciosMale'
import { serviciosFemale } from '../data/serviciosFemale'

const ReservaCorte = () => {
  const[servicio,setServicio] = useState("")

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
      
      <div className='grid md:grid-cols-3'>
        <div className='col-span-2'>
          <div className='flex flex-col'>
            <label htmlFor="">Cliente</label>
            <input type="text" placeholder='Escribe tu nombre'/>
          </div>

          <div className='flex flex-col'>
            <label htmlFor="">Servicios Masculinos</label>
            <select 
            value={servicio}
            onChange={(e)=> setServicio(e.target.value)}
            >
              <option value="">Seleccione el servicio deseado</option>
              {serviciosMale.map((item,index)=>{
                return(
                <option key={index} value={item}>
                  {item}
                </option>
                )
              })}
            </select>
          </div>

          <div className='flex flex-col'>
            <label htmlFor="">Servicios Femeninos</label>
            <select 
            value={servicio}
            onChange={(e)=> setServicio(e.target.value)}
            >
              <option value="">Seleccione el servicio deseado</option>
              {serviciosFemale.map((item,index)=>{
                return(
                  <option value={item} key={index}>
                    {item}
                  </option>
                )
              })
  
              }
            </select>
          </div>
        </div>

        <div>
asdas
        </div>
      </div>
    </div>
    </>
  )
}

export default ReservaCorte
