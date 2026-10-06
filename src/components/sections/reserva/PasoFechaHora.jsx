import { useEffect, useMemo, useRef, useState } from 'react'
import { obtenerDisponibilidad } from '../../../services/api'
import { hoyISO, sumarDiasISO, formatearFechaChip } from '../../../utils/fechas'
import { mensajeErrorSeleccion } from './reservaReducer'

const DIAS_VISIBLES = 30

// servicioIds: los servicios elegidos (1 a 3): la disponibilidad se pide para el bloque completo (duración total).
const PasoFechaHora = ({
  servicioIds,
  barberoId,
  fecha,
  hora,
  onSeleccionarFecha,
  onSeleccionarHora,
  onServicioNoDisponible,
  onErrorSeleccion,
  recargaHoras = 0,
}) => {
  const fechasDisponibles = useMemo(() => {
    const hoy = hoyISO()
    return Array.from({ length: DIAS_VISIBLES }, (_, indice) => sumarDiasISO(hoy, indice))
  }, [])

  const [horas, setHoras] = useState([])
  const [cargandoHoras, setCargandoHoras] = useState(false)
  const [errorHoras, setErrorHoras] = useState('')

  // Ref para no volver a pedir horas cada vez que el padre crea un manejador nuevo.
  const alServicioNoDisponible = useRef(onServicioNoDisponible)
  const alErrorSeleccion = useRef(onErrorSeleccion)
  useEffect(() => {
    alServicioNoDisponible.current = onServicioNoDisponible
    alErrorSeleccion.current = onErrorSeleccion
  }, [onServicioNoDisponible, onErrorSeleccion])

  // Clave estable de la selección: evita volver a pedir horas por una lista nueva con los mismos ids.
  const claveServicios = servicioIds.join(',')

  useEffect(() => {
    // Sin fecha elegida, el render ya muestra "Selecciona primero una fecha" sin mirar
    // `horas`, así que no hace falta limpiar el estado aquí.
    if (!fecha) return undefined

    let cancelado = false

    const cargarHoras = async () => {
      setCargandoHoras(true)
      setErrorHoras('')
      try {
        const data = await obtenerDisponibilidad(claveServicios.split(',').map(Number), fecha, barberoId)
        if (!cancelado) setHoras(data.horas)
      } catch (err) {
        if (err.codigo === 'SERVICIO_NO_DISPONIBLE') {
          // Un servicio se desactivó mientras el usuario reservaba: el padre quita solo los afectados y vuelve al paso Servicio.
          if (!cancelado) alServicioNoDisponible.current?.(err)
          return
        }
        if (mensajeErrorSeleccion(err.codigo)) {
          // Repetidos, más de 3 o combo de más de 240 min: el padre vuelve al paso Servicio con el motivo.
          if (!cancelado) alErrorSeleccion.current?.(err)
          return
        }
        if (!cancelado) setErrorHoras(err.message)
      } finally {
        if (!cancelado) setCargandoHoras(false)
      }
    }

    cargarHoras()

    return () => {
      cancelado = true
    }
  }, [claveServicios, fecha, barberoId, recargaHoras])

  return (
    <div>
      <h2 className="mb-3 text-center font-poppins font-semibold text-black">Elige una fecha</h2>
      <div
        role="group"
        aria-label="Fechas disponibles"
        className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
      >
        {fechasDisponibles.map((fechaOpcion) => {
          const { diaSemana, dia, mes } = formatearFechaChip(fechaOpcion)
          const seleccionada = fechaOpcion === fecha

          return (
            <button
              key={fechaOpcion}
              type="button"
              aria-pressed={seleccionada}
              onClick={() => onSeleccionarFecha(fechaOpcion)}
              className={`flex shrink-0 snap-start flex-col items-center rounded-xl border px-4 py-2 font-poppins motion-safe:transition-colors motion-safe:duration-200 ${
                seleccionada
                  ? 'border-[#D4AF37] bg-[#D4AF37] text-black'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:border-black'
              }`}
            >
              <span className="text-xs uppercase">{diaSemana}</span>
              <span className="text-lg font-bold">{dia}</span>
              <span className="text-xs uppercase">{mes}</span>
            </button>
          )
        })}
      </div>

      <h2 className="mb-3 mt-6 text-center font-poppins font-semibold text-black">Elige una hora</h2>
      {!fecha ? (
        <p className="text-center font-poppins text-zinc-500">Selecciona primero una fecha.</p>
      ) : cargandoHoras ? (
        <p className="text-center font-poppins text-zinc-500">Cargando horas disponibles...</p>
      ) : errorHoras ? (
        <p role="alert" className="text-center font-poppins font-semibold text-red-600">
          {errorHoras}
        </p>
      ) : horas.length === 0 ? (
        <p className="text-center font-poppins text-zinc-500">No hay horas disponibles para esa fecha.</p>
      ) : (
        <div role="group" aria-label="Horas disponibles" className="flex flex-wrap justify-center gap-2">
          {horas.map((horaOpcion) => {
            const seleccionada = horaOpcion === hora

            return (
              <button
                key={horaOpcion}
                type="button"
                aria-pressed={seleccionada}
                onClick={() => onSeleccionarHora(horaOpcion)}
                className={`min-h-11 rounded-lg border px-3 py-1.5 font-poppins font-medium motion-safe:transition-colors motion-safe:duration-200 ${
                  seleccionada
                    ? 'border-[#D4AF37] bg-[#D4AF37] text-black'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:border-black'
                }`}
              >
                {horaOpcion}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PasoFechaHora
