import { useEffect, useMemo, useRef, useState } from 'react'
import { obtenerDisponibilidad } from '../../../services/api'
import { ahoraBogota, hoyISO, sumarDiasISO, formatearFechaChip } from '../../../utils/fechas'
import { CODIGO_PROFESIONAL_INCOMPATIBLE, mensajeErrorSeleccion } from './reservaReducer'
import { TITULO_CITA, planCitas } from '../../../utils/reservaAsesoria'
import { formatearDuracion } from '../../../utils/formato'
import {
  agruparHorasEnBloques,
  bloqueDeHora,
  bloquesVigentes,
  minutosDeHora,
  primeraHoraLibre,
  textoHoraAsignada,
} from '../../../utils/bloquesHorarios'

const DIAS_VISIBLES = 30
const MS_REEVALUAR = 60_000

// servicioIds: los servicios elegidos (1 a 3): la disponibilidad se pide para el bloque completo (duración total).
// `asesorId`: asesor concreto (null = cualquiera) cuando la reserva incluye una asesoría. `servicios` (opcional): los
// objetos elegidos; con asesoría + barbería explican que las horas son las de inicio de la asesoría y que el corte
// empieza al terminar. `onErrorProfesional`: el profesional elegido no atiende esos servicios (400).
// La hora se elige por BLOQUES de 1 hora: al elegir uno se asigna su primera hora libre y `hora` guarda esa hora EXACTA.
// `horaOcupada`: hora que dio 409 al confirmar; al recargar, `onReasignarHora(nueva | null)` pide la siguiente libre del
// mismo bloque (o avisa que ya no hay). `avisoHora`: texto de esa reasignación (role="status").
// Si la fecha es HOY (Bogotá, no la zona del navegador) se ocultan los bloques sin ningún inicio posible por el paso del
// tiempo y se reevalúa cada minuto; "Completa" queda solo para falta de cupo.
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
  horaOcupada = '',
  avisoHora = '',
  onReasignarHora,
}) => {
  const fechasDisponibles = useMemo(() => {
    const hoy = hoyISO()
    return Array.from({ length: DIAS_VISIBLES }, (_, indice) => sumarDiasISO(hoy, indice))
  }, [])

  const [horas, setHoras] = useState([])
  const [cargandoHoras, setCargandoHoras] = useState(false)
  const [errorHoras, setErrorHoras] = useState('')
  // "Ahora" en Bogotá, reevaluado cada minuto. `fechaHoraPasada`: fecha en la que se limpió la hora elegida por pasar el tiempo.
  const [ahora, setAhora] = useState(() => ahoraBogota())
  const [fechaHoraPasada, setFechaHoraPasada] = useState('')

  // Ref para no volver a pedir horas cada vez que el padre crea un manejador nuevo.
  const alServicioNoDisponible = useRef(onServicioNoDisponible)
  const alErrorSeleccion = useRef(onErrorSeleccion)
  const alErrorProfesional = useRef(onErrorProfesional)
  const alReasignarHora = useRef(onReasignarHora)
  const alSeleccionarHora = useRef(onSeleccionarHora)
  // Lo vigente cuando llega la respuesta: la hora elegida y la que dio 409.
  const horaActual = useRef(hora)
  const horaOcupadaActual = useRef(horaOcupada)
  useEffect(() => {
    alServicioNoDisponible.current = onServicioNoDisponible
    alErrorSeleccion.current = onErrorSeleccion
    alErrorProfesional.current = onErrorProfesional
    alReasignarHora.current = onReasignarHora
    alSeleccionarHora.current = onSeleccionarHora
    horaActual.current = hora
    horaOcupadaActual.current = horaOcupada
  }, [onServicioNoDisponible, onErrorSeleccion, onErrorProfesional, onReasignarHora, onSeleccionarHora, hora, horaOcupada])

  // Cada minuto: actualiza "ahora" y, si hoy la hora elegida ya pasó, la limpia y lo avisa.
  useEffect(() => {
    const id = setInterval(() => {
      const nuevo = ahoraBogota()
      setAhora(nuevo)
      const elegida = horaActual.current
      if (fecha && fecha === nuevo.fecha && elegida && minutosDeHora(elegida) <= nuevo.minutos) {
        alSeleccionarHora.current?.('')
        setFechaHoraPasada(fecha)
      }
    }, MS_REEVALUAR)
    return () => clearInterval(id)
  }, [fecha])

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
        if (cancelado) return
        setHoras(data.horas)
        const ocupada = horaOcupadaActual.current
        if (ocupada) {
          // 409 al confirmar: se prueba la siguiente hora libre del mismo bloque (sin contar la que se ocupó).
          const bloque = agruparHorasEnBloques(data.horas).find((b) => b.clave === bloqueDeHora(ocupada)?.clave)
          alReasignarHora.current?.(bloque ? primeraHoraLibre(bloque, [ocupada]) : null)
        } else if (horaActual.current && !data.horas.includes(horaActual.current)) {
          // La hora elegida ya no es válida con estos datos: se limpia.
          alSeleccionarHora.current?.('')
        }
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

  // Hoy solo cuentan los inicios posteriores al minuto actual (como el back-end): la respuesta puede estar desfasada.
  const esHoy = fecha === ahora.fecha
  const minutosAhora = esHoy ? ahora.minutos : null
  const horasVigentes = useMemo(
    () => (minutosAhora === null ? horas : horas.filter((h) => minutosDeHora(h) > minutosAhora)),
    [horas, minutosAhora]
  )
  // Los bloques del día (hoy, sin los ya pasados) con sus horas libres; se recalculan con cada respuesta y cada minuto.
  const bloques = useMemo(
    () => bloquesVigentes(agruparHorasEnBloques(horasVigentes), minutosAhora),
    [horasVigentes, minutosAhora]
  )
  const diaTerminado = Boolean(fecha) && esHoy && bloques.length === 0
  const bloqueElegido = bloqueDeHora(hora)?.clave

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
                  ? 'border-oro bg-oro text-black'
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
      ) : diaTerminado ? (
        <p role="status" className="text-center font-poppins font-semibold text-zinc-700">
          Ya no quedan horarios para hoy. Elige otra fecha.
        </p>
      ) : cargandoHoras ? (
        <p className="text-center font-poppins text-zinc-500">Cargando horas disponibles...</p>
      ) : errorHoras ? (
        <p role="alert" className="text-center font-poppins font-semibold text-red-600">
          {errorHoras}
        </p>
      ) : horas.length === 0 ? (
        <p className="text-center font-poppins text-zinc-500">No hay horas disponibles para esa fecha.</p>
      ) : (
        <>
          <p className="mb-3 text-center font-poppins text-sm text-zinc-600">
            Elige un bloque de una hora y te asignamos la primera hora libre dentro de él.
          </p>
          <div
            role="group"
            aria-label="Horas disponibles"
            className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 md:grid-cols-5"
          >
            {bloques.map((bloque) => {
              const seleccionado = bloque.clave === bloqueElegido
              const base =
                'flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg border px-2 py-1.5 font-poppins'

              if (!bloque.disponible) {
                // Sin horas: visible pero no se puede elegir (aria-disabled, sigue enfocable; el texto "Completa" lo dice).
                return (
                  <button
                    key={bloque.clave}
                    type="button"
                    aria-disabled="true"
                    onClick={(evento) => evento.preventDefault()}
                    className={`${base} cursor-not-allowed border-dashed border-zinc-300 bg-zinc-100 text-zinc-600`}
                  >
                    <span className="text-base font-semibold">{bloque.etiqueta}</span>
                    <span className="text-xs font-medium">Completa</span>
                  </button>
                )
              }

              return (
                <button
                  key={bloque.clave}
                  type="button"
                  aria-pressed={seleccionado}
                  onClick={() => onSeleccionarHora(primeraHoraLibre(bloque))}
                  className={`${base} motion-safe:transition-colors motion-safe:duration-200 ${
                    seleccionado
                      ? 'border-oro bg-oro text-black'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-black'
                  }`}
                >
                  <span className="text-base font-semibold">{bloque.etiqueta}</span>
                  <span className="text-xs font-medium">Disponible</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Aviso de reasignación y hora EXACTA asignada (y, en una combinada, a qué hora empieza y termina cada parte);
          se anuncia al cambiar. */}
      <div role="status" aria-live="polite">
        {!hora && fechaHoraPasada === fecha && (
          <p className="mt-4 text-center font-poppins text-sm font-semibold text-black">
            El horario que elegiste ya pasó. Elige otro bloque.
          </p>
        )}
        {avisoHora && <p className="mt-4 text-center font-poppins text-sm font-semibold text-black">{avisoHora}</p>}
        {hora && (
          <p className="mt-4 text-center font-poppins text-sm font-semibold text-black">
            {textoHoraAsignada(hora, combinada ? 'tu asesoría' : 'tu cita')}
          </p>
        )}
        {combinada && hora && (
          <ul className="mt-1 space-y-1 text-center font-poppins text-sm font-semibold text-black">
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
