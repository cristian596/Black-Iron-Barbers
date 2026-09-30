import { useEffect, useState } from 'react'
import { obtenerServicios, obtenerBarberos, obtenerDisponibilidad, crearCita } from '../services/api'

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ReservaCorte = () => {
  const [cliente, setCliente] = useState('')
  const [correo, setCorreo] = useState('')
  const [servicioId, setServicioId] = useState('')
  const [barberoId, setBarberoId] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const fechaHoy = new Date().toISOString().split('T')[0]

  const [servicios, setServicios] = useState([])
  const [barberos, setBarberos] = useState([])
  const [horas, setHoras] = useState([])

  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [cargandoHoras, setCargandoHoras] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState('')

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [serviciosData, barberosData] = await Promise.all([
          obtenerServicios(),
          obtenerBarberos(),
        ])
        setServicios(serviciosData)
        setBarberos(barberosData)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargandoDatos(false)
      }
    }
    cargarDatos()
  }, [])

  useEffect(() => {
    const cargarHoras = async () => {
      if (!barberoId || !fecha) {
        setHoras([])
        return
      }

      setCargandoHoras(true)
      setHora('')
      try {
        const data = await obtenerDisponibilidad(barberoId, fecha)
        setHoras(data.horas)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargandoHoras(false)
      }
    }
    cargarHoras()
  }, [barberoId, fecha])

  const handleAgendar = async () => {
    setError('')
    setConfirmacion('')

    if (!cliente.trim()) {
      setError('El nombre del cliente es obligatorio')
      return
    }
    if (!REGEX_CORREO.test(correo)) {
      setError('El correo no es válido')
      return
    }
    if (!servicioId || !barberoId || !fecha || !hora) {
      setError('Selecciona servicio, barbero, fecha y hora')
      return
    }

    setEnviando(true)
    try {
      await crearCita({
        cliente: cliente.trim(),
        correo,
        servicio_id: Number(servicioId),
        barbero_id: Number(barberoId),
        fecha,
        hora,
      })
      setConfirmacion('¡Cita agendada con éxito! Te esperamos.')
      setHora('')
      setFecha('')
    } catch (err) {
      if (err.status === 409) {
        setError('Ese horario ya fue tomado, elige otra hora')
        try {
          const data = await obtenerDisponibilidad(barberoId, fecha)
          setHoras(data.horas)
        } catch {
          setHoras([])
        }
      } else {
        setError(err.message)
      }
    } finally {
      setEnviando(false)
    }
  }

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
              <label htmlFor="cliente" className='flex items-center justify-center font-poppins font-medium text-lg text-mauve-700 '>Cliente</label>
              <input
                id="cliente"
                name="cliente"
                onChange={(e)=>setCliente(e.target.value)}
                value={cliente}
                type="text"
                placeholder='Escribe tu nombre'
                className='w-120 rounded-lg p-1 border placeholder:text-gray-800'
              />
            </div>

            <div className='flex flex-col mt-2'>
              <label htmlFor="correo" className='flex items-center justify-center font-poppins font-medium text-lg text-mauve-700 '>Correo Electronico</label>
              <input
                id="correo"
                name="correo"
                type="email"
                required
                value={correo}
                onChange={(e)=>setCorreo(e.target.value)}
                placeholder='Example@gmail.com'
                className='w-120 p-1 border placeholder:text-gray-800 rounded-lg'
              />
            </div>
          </div>

          {cargandoDatos ? (
            <p className='text-center mt-4 font-poppins'>Cargando servicios...</p>
          ) : (
            <div className='flex flex-col mt-2'>
              <label htmlFor="servicio" className='font-poppins font-medium text-lg text-mauve-700 mt-2 mb-2'>Servicios</label>
              <div id="servicio" className='flex gap-2 flex-wrap'>
                {servicios.map((serv)=>{
                  return(
                    <button
                    type='button'
                    key={serv.id}
                    onClick={()=>setServicioId(serv.id)}
                    className={`border border-gray-500 p-2 rounded-xl cursor-pointer active:scale-95 duration-300 hover:bg-mauve-300 ${
                      servicioId === serv.id
                      ? "bg-mauve-400 border-black font-semibold"
                      : "bg-mauve-100"
                    }`}
                    >
                      {serv.nombre} - {serv.duracion_min} min - ${serv.precio}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            {servicioId && (
              <div className='flex flex-col'>
                <label htmlFor="barbero" className='font-poppins font-medium text-lg text-mauve-700 mt-2 mb-2'>Elige tu Barbero</label>
                <div id="barbero" className='grid grid-cols-6 gap-2'>
                  {barberos.map((barber)=>{
                    return(
                      <button
                      type='button'
                      key={barber.id}
                      onClick={()=> setBarberoId(barber.id)}
                      className={`flex flex-col border w-50 rounded-xl cursor-pointer hover:bg-gray-300 active:scale-95 duration-300 ${
                        barberoId === barber.id
                        ? "bg-gray-400"
                        : "bg-white"
                      }`}
                      >
                      <h3>{barber.nombre}</h3>
                      <p>{barber.especialidad}</p>
                      </button>
                    )
                    })
                  }
                </div>
              </div>
          )}
          </div>

          <div className='mt-3'>
            {barberoId && (
              <div>
                <label htmlFor="fecha" className='font-poppins font-medium text-lg text-mauve-700'>Seleccione la fecha para agendar su servicio</label>
                <div className='mt-1'>
                  <input
                  id="fecha"
                  name="fecha"
                  type="date"
                  className='border text-xl'
                  value={fecha}
                  min={fechaHoy}
                  onChange={(e)=>setFecha(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className='mt-3'>
            {fecha && (
              <div>
                <label htmlFor="hora" className='font-poppins font-medium text-lg text-mauve-700'>Seleccione la hora de su servicio</label>
                {cargandoHoras ? (
                  <p className='mt-1 font-poppins'>Cargando horas disponibles...</p>
                ) : horas.length === 0 ? (
                  <p className='mt-1 font-poppins'>No hay horas disponibles para esa fecha</p>
                ) : (
                  <div id="hora" className='flex gap-2 mt-1 flex-wrap'>
                    {horas.map((horaSe)=>{
                      return(
                        <button
                        type='button'
                        key={horaSe}
                        onClick={()=>setHora(horaSe)}
                        className={`border p-1 rounded-lg font-medium font-sans cursor-pointer hover:bg-mauve-200 active:scale-95 duration-300 ${
                          hora === horaSe
                          ? "bg-mauve-400 border-gray-400"
                          : "bg-white"
                        }`}
                        >
                          {horaSe}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className='text-red-600 font-semibold text-center mt-3'>{error}</p>
          )}
          {confirmacion && (
            <p className='text-green-600 font-semibold text-center mt-3'>{confirmacion}</p>
          )}

          <div className='flex justify-center p-20'>
            {hora && (
              <button
                type='button'
                onClick={handleAgendar}
                disabled={enviando}
                className='border border-gray-800 p-2 font-cinzel font-bold text-2xl rounded-xl text-white bg-red-500 hover:bg-red-200 hover:text-black hover:border-gray-900 cursor-pointer active:scale-95 duration-300 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {enviando ? 'Agendando...' : 'Agendar Cita'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default ReservaCorte
