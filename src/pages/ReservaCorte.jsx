import React, { useState } from 'react'
import { serviciosMale } from '../data/serviciosMale'
import { serviciosFemale } from '../data/serviciosFemale'
import {colaboradores} from '../data/barberos'
import { horarios } from '../data/horarios'

const ReservaCorte = () => {
  const[servicio,setServicio] = useState("")
  const [barbero, setBarbero] = useState("")
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
      
      <div className='grid md:grid-cols-3 border'>
        <div className='md:row-span-2 border p-4'>
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

          <div className='flex flex-col'>
            <label htmlFor="">Elige tu Barbero</label>
            <select 
            value={barbero}
            onChange={(e)=> setBarbero(e.target.value)}
            >
              <option>Escoje tu barbero preferido</option>
              {colaboradores.map((barbero)=>{
                return(
                  <option value={barbero} key={barbero.id}>
                    {barbero.nombre}
                    {barbero.calificacion}
                  </option>
                )
              })
              }
            </select>
          </div>

          <div className='flex flex-col'>
            <label htmlFor="">Selecciona la fecha</label>
            <input type="date" />
          </div>

          <div className=''>
            <label htmlFor="">Hora de tu servicio</label>
            <div>
              {horarios.map((horaSe)=>{

                return(
                  <button
                  type='button'
                  key={horaSe}
                  className='cursor-pointer'
                  >
                    {horaSe}
                  </button>
                )
              })

              }
            </div>
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
