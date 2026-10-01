import { useEffect, useState } from "react"
import { obtenerServicios } from "../services/api"
import { FcClock } from "react-icons/fc";
import { MdAttachMoney } from "react-icons/md";

const Cortes = () => {
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargarServicios = async () => {
      try {
        const data = await obtenerServicios()
        setServicios(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargarServicios()
  }, [])

  return (
    <>
        <div className='grid justify-center items-center py-3 bg-linear-to-br from-zinc-800 to-amber-600'>
            <h1 className='flex items-center justify-center text-white py-3 font-bold font-cinzel text-3xl lg:text-6xl'>NUESTRA CARTA DE SERVICIOS</h1>

            {cargando && (
                <p className='text-center text-white font-cinzel text-xl py-5'>Cargando servicios...</p>
            )}

            {error && (
                <p className='text-center text-white font-cinzel text-xl py-5'>{error}</p>
            )}

            {!cargando && !error && (
                <div className="grid grid-cols-2 xl:grid-cols-5 gap-2 p-5">
                    {servicios.map((servicio)=>(
                        <div key={servicio.id}
                        className='p-2 flex flex-col bg-white border rounded-2xl '
                        >
                            <h3 className="text-xl m-2 font-bold font-cinzel">
                                <span>{servicio.nombre}</span>
                            </h3>
                            <p className="flex items-center justify-around text-2xl font-cinzel font-semibold">
                                <span className="flex gap-2">
                                    <FcClock />{servicio.duracion_min} min
                                </span>
                                <span className="flex gap-1">
                                    <MdAttachMoney size={30}/>
                                    {servicio.precio}
                                </span>
                            </p>
                        </div>
                    ))}
                </div>
            )}
            </div>
    </>
  )
}

export default Cortes
