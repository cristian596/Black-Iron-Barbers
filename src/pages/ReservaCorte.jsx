import { useEffect, useReducer, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { obtenerServicios, obtenerBarberos, crearCita } from '../services/api'
import IndicadorProgreso from '../components/sections/reserva/IndicadorProgreso'
import PasoServicio from '../components/sections/reserva/PasoServicio'
import PasoBarbero from '../components/sections/reserva/PasoBarbero'
import PasoFechaHora from '../components/sections/reserva/PasoFechaHora'
import ModalConfirmacion from '../components/sections/reserva/ModalConfirmacion'
import PantallaExito from '../components/sections/reserva/PantallaExito'
import ResumenReserva from '../components/sections/reserva/ResumenReserva'
import { PASOS_RESERVA } from '../components/sections/reserva/pasos'
import { reservaReducer, estadoInicialReserva } from '../components/sections/reserva/reservaReducer'

const pasoCompleto = (estado) => {
  switch (estado.paso) {
    case 'servicio':
      return Boolean(estado.servicioId)
    case 'barbero':
      return true // "Cualquier barbero" (null) ya es una elección válida
    case 'fecha-hora':
      return Boolean(estado.fecha && estado.hora)
    default:
      return false
  }
}

const ReservaCorte = () => {
  const [searchParams] = useSearchParams()
  const servicioInicial = searchParams.get('servicio')
  const barberoInicial = searchParams.get('barbero')

  const [estado, dispatch] = useReducer(
    reservaReducer,
    estadoInicialReserva(
      servicioInicial ? Number(servicioInicial) : '',
      barberoInicial ? Number(barberoInicial) : null
    )
  )

  const [servicios, setServicios] = useState([])
  const [barberos, setBarberos] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [serviciosData, barberosData] = await Promise.all([obtenerServicios(), obtenerBarberos()])
        setServicios(serviciosData)
        setBarberos(barberosData)
      } catch (err) {
        setErrorCarga(err.message)
      } finally {
        setCargandoDatos(false)
      }
    }
    cargarDatos()
  }, [])

  const indiceActual = PASOS_RESERVA.findIndex((paso) => paso.key === estado.paso)
  const esPrimerPaso = indiceActual === 0
  const esUltimoPaso = indiceActual === PASOS_RESERVA.length - 1

  const irAPasoAnterior = () => {
    if (!esPrimerPaso) {
      dispatch({ type: 'IR_A_PASO', paso: PASOS_RESERVA[indiceActual - 1].key })
    }
  }

  const irAPasoSiguiente = () => {
    if (!esUltimoPaso && pasoCompleto(estado)) {
      dispatch({ type: 'IR_A_PASO', paso: PASOS_RESERVA[indiceActual + 1].key })
    }
  }

  const confirmarReserva = async (datosContacto) => {
    try {
      const resumen = await crearCita({
        cliente: datosContacto.cliente,
        correo: datosContacto.correo,
        telefono: datosContacto.telefono,
        consentimiento: datosContacto.consentimiento,
        servicio_id: estado.servicioId,
        barbero_id: estado.barberoId === null ? undefined : estado.barberoId,
        fecha: estado.fecha,
        hora: estado.hora,
      })
      dispatch({ type: 'RESERVA_CONFIRMADA', resumen })
    } catch (err) {
      if (err.status === 409) {
        // La hora ya no es válida: se vuelve al paso de fecha/hora con disponibilidad
        // recargada, en vez de dejar el modal mostrando un error sobre algo que ya cambió.
        dispatch({ type: 'HORA_OCUPADA' })
        return
      }
      throw err
    }
  }

  if (estado.paso === 'exito') {
    return <PantallaExito resumen={estado.resumen} onNuevaReserva={() => dispatch({ type: 'REINICIAR' })} />
  }

  const servicioSeleccionado = servicios.find((servicio) => servicio.id === estado.servicioId)
  const barberoSeleccionado =
    estado.barberoId === null ? null : barberos.find((barbero) => barbero.id === estado.barberoId)

  const mostrarResumen = estado.paso !== 'confirmar'

  return (
    <div className={`flex flex-col items-center px-4 py-8 ${mostrarResumen ? 'pb-28 lg:pb-8' : ''}`}>
      <h1 className="text-center font-cinzel text-4xl font-semibold text-black sm:text-5xl">
        Reserva tu Experiencia
      </h1>
      <p className="mt-3 text-center font-poppins text-base text-zinc-600 sm:text-xl">
        Selecciona la hora, define tu estilo y permítenos encargarnos del resto.
      </p>

      <div className="mt-8 flex w-full max-w-5xl flex-col items-start gap-8 lg:flex-row lg:justify-center">
        <div className="flex w-full flex-col items-center lg:max-w-2xl">
          <div className="w-full">
            <IndicadorProgreso pasoActual={estado.paso} />
          </div>

          {errorCarga && (
            <p role="alert" className="mt-6 font-poppins font-semibold text-red-600">
              {errorCarga}
            </p>
          )}

          {estado.errorGlobal && (
            <p role="alert" className="mt-6 font-poppins font-semibold text-red-600">
              {estado.errorGlobal}
            </p>
          )}

          <div className="mt-8 w-full">
            {cargandoDatos ? (
              <p className="text-center font-poppins text-zinc-600">Cargando información...</p>
            ) : (
              <>
                {estado.paso === 'servicio' && (
                  <PasoServicio
                    servicios={servicios}
                    servicioIdSeleccionado={estado.servicioId}
                    onSeleccionar={(servicioId) => dispatch({ type: 'SELECCIONAR_SERVICIO', servicioId })}
                  />
                )}
                {estado.paso === 'barbero' && (
                  <PasoBarbero
                    barberos={barberos}
                    barberoIdSeleccionado={estado.barberoId}
                    onSeleccionar={(barberoId) => dispatch({ type: 'SELECCIONAR_BARBERO', barberoId })}
                  />
                )}
                {estado.paso === 'fecha-hora' && (
                  <PasoFechaHora
                    servicioId={estado.servicioId}
                    barberoId={estado.barberoId}
                    fecha={estado.fecha}
                    hora={estado.hora}
                    recargaHoras={estado.recargaHoras}
                    onSeleccionarFecha={(fecha) => dispatch({ type: 'SELECCIONAR_FECHA', fecha })}
                    onSeleccionarHora={(hora) => dispatch({ type: 'SELECCIONAR_HORA', hora })}
                  />
                )}
              </>
            )}
          </div>

          {estado.paso !== 'confirmar' && (
            <div className="mt-10 flex w-full items-center">
              <button
                type="button"
                onClick={irAPasoAnterior}
                disabled={esPrimerPaso}
                className="rounded-xl border border-black px-5 py-2 font-poppins font-semibold text-black duration-200 hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-black"
              >
                Atrás
              </button>
            </div>
          )}
        </div>

        {mostrarResumen && !cargandoDatos && (
          <ResumenReserva
            servicio={servicioSeleccionado}
            barbero={barberoSeleccionado}
            mostrarBarbero={indiceActual >= 1}
            fecha={estado.fecha}
            hora={estado.hora}
            onContinuar={irAPasoSiguiente}
            puedeContinuar={!esUltimoPaso && pasoCompleto(estado)}
          />
        )}
      </div>

      {estado.paso === 'confirmar' && (
        <ModalConfirmacion
          servicio={servicioSeleccionado}
          barbero={barberoSeleccionado}
          fecha={estado.fecha}
          hora={estado.hora}
          onClose={() => dispatch({ type: 'IR_A_PASO', paso: 'fecha-hora' })}
          onConfirmar={confirmarReserva}
        />
      )}
    </div>
  )
}

export default ReservaCorte
