import React from "react"
import { SERVICIOS_DATA } from "../data/servicios"
import { FcClock } from "react-icons/fc";
import { MdAttachMoney } from "react-icons/md";

const Cortes = () => {
  return (
    <>
        <div className='grid justify-center items-center py-3 bg-linear-to-br from-zinc-800 to-amber-600'>
            <h1 className='flex items-center justify-center text-white py-3 font-bold font-cinzel text-3xl lg:text-6xl'>NUESTRA CARTA DE SERVICIOS</h1>

            {SERVICIOS_DATA.map((bloque,idx)=>(
                <React.Fragment key= {idx}>
                    <h2 className="text-6xl text-white font-cinzel font-semibold text-center m-10">
                        {bloque.categoria}
                    </h2>
                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-2 p-5">
                        {bloque.items.map((servicios,itemIdx)=>(
                            <div key={itemIdx}
                            className='p-2 flex flex-col bg-white border rounded-2xl '
                            >
                                <h3 className="text-xl m-2 font-bold font-cinzel">
                                    <span>{servicios.nombre}</span>
                                </h3>
                                <p className="flex items-center justify-around text-2xl font-cinzel font-semibold">
                                    <span className="flex gap-2">
                                        <FcClock />{servicios.duracion}
                                    </span>
                                    <span className="flex gap-1">
                                        <MdAttachMoney size={30}/>
                                        {servicios.precio}
                                    </span>
                                </p>
                            </div>        
                        ))}
                    </div>
                </React.Fragment>
                ))}
            </div>
    </>
  )
}

export default Cortes
