import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { obtenerServicios, obtenerBarberos, crearCita } from '../services/api'
import { useCarrito } from '../context/CarritoContext'
import IndicadorProgreso from '../components/sections/reserva/IndicadorProgreso'
import PasoServicio from '../components/sections/reserva/PasoServicio'
import PasoBarbero from '../components/sections/reserva/PasoBarbero'
import PasoFechaHora from '../components/sections/reserva/PasoFechaHora'
import ModalConfirmacion from '../components/sections/reserva/ModalConfirmacion'
import PantallaExito from '../components/sections/reserva/PantallaExito'
import ResumenReserva from '../components/sections/reserva/ResumenReserva'
import ErrorCarga from '../components/ui/ErrorCarga'
import { PASOS_RESERVA } from '../components/sections/reserva/pasos'
import {
  reservaReducer,
  estadoInicialReserva,
  mensajeErrorSeleccion,
} from '../components/sections/reserva/reservaReducer'
import { MAX_DURACION_COMBO_MIN, duracionTotal } from '../utils/carrito'
import { leerServiciosDeUrl } from '../utils/seleccionReserva'

const pasoCompleto = (estado) => {
  switch (estado.paso) {
    case 'servicio':
      return estado.servicioIds.length > 0
    case 'barbero':
      return true // "Cualquier barbero" (null) ya es una elección válida
    case 'fecha-hora':
      return Boolean(estado.fecha && estado.hora)
    default:
      return false
  }
}

// Estado de la reserva: propio de esta página y NUNCA ligado al carrito. Arranca desde la URL —?servicios=1,2,3 (viene
// del carrito) o ?servicio=<id> (camino rápido desde una tarjeta)— y, a partir de ahí, lo que se cambie en el paso 1
// no toca el carrito. Al reservar con éxito se vacía el carrito SOLO si la reserva llegó con ?servicios= (es decir,
// desde el carrito); una reserva por el camino rápido deja el carrito como estaba.
const ReservaCorte = () => {
  const [searchParams] = useSearchParams()
  const [{ ids: serviciosIniciales, desdeCarrito }] = useState(() => leerServiciosDeUrl(searchParams))
  const barberoInicial = searchParams.get('barbero')
  const { vaciar: vaciarCarrito } = useCarrito()

  const [estado, dispatch] = useReducer(
    reservaReducer,
    undefined,
    () => estadoInicialReserva(serviciosIniciales, barberoInicial ? Number(barberoInicial) : null)
  )

  const [servicios, setServicios] = useState([])
  const [barberos, setBarberos] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  // Se incrementa para volver a pedir servicios y barberos (Reintentar, o un servicio que dejó de estar activo).
  const [recarga, setRecarga] = useState(0)

  const recargarDatos = useCallback(() => {
    setErrorCarga('')
    setCargandoDatos(true)
    setRecarga((veces) => veces + 1)
  }, [])

  // Las tres vías (400 al confirmar, 400 al pedir horas, enlace viejo) terminan igual: se quitan SOLO los servicios
  // afectados (`err.servicios_no_disponibles`), se conserva el resto, se vuelve al paso Servicio con aviso y la lista
  // de servicios se vuelve a pedir.
  const manejarServicioNoDisponible = useCallback(
    (err) => {
      dispatch({ type: 'SERVICIO_NO_DISPONIBLE', ids: err?.servicios_no_disponibles })
      recargarDatos()
    },
    [recargarDatos]
  )

  // Repetidos, más de 3 o combo de más de 240 min: se vuelve al paso Servicio con el motivo y la selección intacta.
  const manejarErrorSeleccion = useCallback((err) => {
    dispatch({ type: 'ERROR_SELECCION', mensaje: mensajeErrorSeleccion(err.codigo) })
  }, [])

  // La carga asíncrona necesita los servicios elegidos más recientes (p. ej. los de ?servicios=...).
  const servicioIdsRef = useRef(estado.servicioIds)
  useEffect(() => {
    servicioIdsRef.current = estado.servicioIds
  }, [estado.servicioIds])

  useEffect(() => {
    let cancelado = false
    let recargando = false

    const cargarDatos = async () => {
      try {
        const [serviciosData, barberosData] = await Promise.all([obtenerServicios(), obtenerBarberos()])
        if (cancelado) return
        setServicios(serviciosData)
        setBarberos(barberosData)

        // Enlace viejo: ?servicios=... con ids inactivos o inexistentes. Solo esos se quitan; el resto se conserva.
        const elegidos = servicioIdsRef.current
        const inactivos = elegidos.filter((id) => !serviciosData.some((servicio) => servicio.id === id))
        if (inactivos.length > 0) {
          recargando = true
          manejarServicioNoDisponible({ servicios_no_disponibles: inactivos })
        } else if (elegidos.length > 1) {
          // Un combo de la URL que pasa del tope de duración se avisa desde el principio (el servidor también lo rechaza).
          const datos = elegidos.map((id) => serviciosData.find((servicio) => servicio.id === id))
          if (duracionTotal(datos) > MAX_DURACION_COMBO_MIN) {
            dispatch({ type: 'ERROR_SELECCION', mensaje: mensajeErrorSeleccion('DURACION_EXCEDIDA') })
          }
        }
      } catch (err) {
        if (!cancelado) setErrorCarga(err.message)
      } finally {
        if (!cancelado && !recargando) setCargandoDatos(false)
      }
    }
    cargarDatos()

    return () => {
      cancelado = true
    }
  }, [recarga, manejarServicioNoDisponible])

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
        servicios_ids: estado.servicioIds,
        barbero_id: estado.barberoId === null ? undefined : estado.barberoId,
        fecha: estado.fecha,
        hora: estado.hora,
      })
      // La reserva terminó: si llegó desde el carrito, esa selección ya se agendó y se vacía.
      if (desdeCarrito) vaciarCarrito()
      dispatch({ type: 'RESERVA_CONFIRMADA', resumen })
    } catch (err) {
      if (err.codigo === 'SERVICIO_NO_DISPONIBLE') {
        // Un servicio se desactivó mientras el usuario reservaba: se cierra el modal, se quitan solo los afectados y
        // se vuelve al paso Servicio.
        manejarServicioNoDisponible(err)
        return
      }
      if (mensajeErrorSeleccion(err.codigo)) {
        manejarErrorSeleccion(err)
        return
      }
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

  const serviciosSeleccionados = estado.servicioIds
    .map((id) => servicios.find((servicio) => servicio.id === id))
    .filter(Boolean)
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
        <div className="flex w-full min-w-0 flex-col items-center lg:max-w-2xl">
          <div className="w-full">
            <IndicadorProgreso pasoActual={estado.paso} />
          </div>

          {errorCarga && <ErrorCarga mensaje={errorCarga} onReintentar={recargarDatos} />}

          {estado.errorGlobal && (
            <p role="alert" className="mt-6 font-poppins font-semibold text-red-600">
              {estado.errorGlobal}
            </p>
          )}

          <div className="mt-8 w-full">
            {cargandoDatos ? (
              <p role="status" className="text-center font-poppins text-zinc-600">
                Cargando información...
              </p>
            ) : errorCarga ? null : (
              <>
                {estado.paso === 'servicio' && (
                  <PasoServicio
                    servicios={servicios}
                    idsSeleccionados={estado.servicioIds}
                    onSeleccionar={(servicioIds) => dispatch({ type: 'SELECCIONAR_SERVICIOS', servicioIds })}
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
                    servicioIds={estado.servicioIds}
                    barberoId={estado.barberoId}
                    fecha={estado.fecha}
                    hora={estado.hora}
                    recargaHoras={estado.recargaHoras}
                    onSeleccionarFecha={(fecha) => dispatch({ type: 'SELECCIONAR_FECHA', fecha })}
                    onSeleccionarHora={(hora) => dispatch({ type: 'SELECCIONAR_HORA', hora })}
                    onServicioNoDisponible={manejarServicioNoDisponible}
                    onErrorSeleccion={manejarErrorSeleccion}
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
                className="min-h-11 rounded-xl border border-black px-5 py-2 font-poppins font-semibold text-black duration-200 hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-black"
              >
                Atrás
              </button>
            </div>
          )}
        </div>

        {mostrarResumen && !cargandoDatos && !errorCarga && (
          <ResumenReserva
            servicios={serviciosSeleccionados}
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
          servicios={serviciosSeleccionados}
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
