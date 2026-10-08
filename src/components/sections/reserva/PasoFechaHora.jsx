import { useEffect, useMemo, useRef, useState } from 'react'
import { obtenerDisponibilidad } from '../../../services/api'
import { hoyISO, sumarDiasISO, formatearFechaChip } from '../../../utils/fechas'
import { CODIGO_PROFESIONAL_INCOMPATIBLE, mensajeErrorSeleccion } from './reservaReducer'
import { TITULO_CITA, planCitas } from '../../../utils/reservaAsesoria'
import { formatearDuracion } from '../../../utils/formato'

const DIAS_VISIBLES = 30

// servicioIds: los servicios elegidos (1 a 3): la disponibilidad se pide para el bloque completo (duración total).
// `asesorId`: asesor concreto (null = cualquiera) cuando la reserva incluye una asesoría. `servicios` (opcional): los
// objetos elegidos; con asesoría + barbería explican que las horas son las de inicio de la asesoría y que el corte
// empieza al terminar. `onErrorProfesional`: el profesional elegido no atiende esos servicios (400).
const PasoFechaHora = ({
  servicioIds,
  barberoId,
  asesorId = null,
  servicios = [],
  fecha,
  hora,
  onSeleccionarFecha,
  onSeleccionarHora,
  onServicioNoDisponible,
  onErrorSeleccion,
  onErrorProfesional,
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
  const alErrorProfesional = useRef(onErrorProfesional)
  useEffect(() => {
    alServicioNoDisponible.current = onServicioNoDisponible
    alErrorSeleccion.current = onErrorSeleccion
    alErrorProfesional.current = onErrorProfesional
  }, [onServicioNoDisponible, onErrorSeleccion, onErrorProfesional])

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
        const ids = claveServicios.split(',').map(Number)
        // El asesor solo viaja cuando hay uno elegido: sin él, "cualquier asesor" (o la reserva no lleva asesoría).
        const data =
          asesorId === null
            ? await obtenerDisponibilidad(ids, fecha, barberoId)
            : await obtenerDisponibilidad(ids, fecha, barberoId, asesorId)
        if (!cancelado) setHoras(data.horas)
      } catch (err) {
        if (err.codigo === 'SERVICIO_NO_DISPONIBLE') {
          // Un servicio se desactivó mientras el usuario reservaba: el padre quita solo los afectados y vuelve al paso Servicio.
          if (!cancelado) alServicioNoDisponible.current?.(err)
          return
        }
        if (mensajeErrorSeleccion(err.codigo)) {
          // Repetidos, más de 3, más de una asesoría o combo de más de 240 min: el padre vuelve al paso Servicio con el motivo.
          if (!cancelado) alErrorSeleccion.current?.(err)
          return
        }
        if (err.codigo === CODIGO_PROFESIONAL_INCOMPATIBLE) {
          // El profesional elegido no atiende esos servicios: el padre vuelve al paso de profesionales.
          if (!cancelado) alErrorProfesional.current?.(err)
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
  }, [claveServicios, fecha, barberoId, asesorId, recargaHoras])

  // Asesoría + barbería: las horas son las de inicio de la asesoría; el corte empieza cuando ella termina.
  const plan = planCitas(servicios, hora)
  const combinada = plan.length === 2

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

      <h2 className="mb-3 mt-6 text-center font-poppins font-semibold text-black">
        {combinada ? 'Elige la hora de tu asesoría' : 'Elige una hora'}
      </h2>
      {combinada && (
        <p className="mx-auto mb-3 max-w-md text-center font-poppins text-sm text-zinc-600">
          Estas son las horas de inicio de tu asesoría ({formatearDuracion(plan[0].duracion)}). Tu servicio de barbería
          empieza justo cuando ella termina.
        </p>
      )}
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

      {/* Con la hora elegida se ve a qué hora empieza y termina cada parte; se anuncia al cambiar la hora. */}
      <div role="status" aria-live="polite">
        {combinada && hora && (
          <ul className="mt-4 space-y-1 text-center font-poppins text-sm font-semibold text-black">
            {plan.map((cita) => (
              <li key={cita.clave}>
                {TITULO_CITA[cita.clave]}: {cita.inicio} – {cita.fin}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default PasoFechaHora
