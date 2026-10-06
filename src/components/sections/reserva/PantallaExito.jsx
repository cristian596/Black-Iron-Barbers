import { formatearFechaLegible } from '../../../utils/fechas'
import { formatearDuracion, formatearPrecio } from '../../../utils/formato'
import ListaServiciosReserva from './ListaServiciosReserva'

// `resumen` es la respuesta de POST /api/citas: con varios servicios trae `servicios` (nombre, duración y precio de
// cada uno) y `duracion_min` y `precio` ya son los totales.
const PantallaExito = ({ resumen, onNuevaReserva }) => {
  const esCombo = Array.isArray(resumen.servicios) && resumen.servicios.length > 1

  return (
  <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
    <span
      aria-hidden="true"
      className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D4AF37] text-3xl font-bold text-black"
    >
      ✓
    </span>
    <h1 className="font-cinzel text-3xl font-semibold text-black">¡Cita agendada con éxito!</h1>
    <p className="font-poppins text-zinc-600">Te esperamos en Black Iron Barbers.</p>

    <dl className="mt-2 w-full max-w-sm space-y-1 rounded-2xl border border-zinc-200 bg-white p-5 text-left font-poppins text-sm shadow-sm">
      {esCombo ? (
        <div>
          <dt className="text-zinc-500">Servicios</dt>
          <dd className="mt-1 font-semibold text-black">
            <ListaServiciosReserva servicios={resumen.servicios} conPrecio />
          </dd>
        </div>
      ) : (
        <div className="flex justify-between gap-2">
          <dt className="shrink-0 text-zinc-500">Servicio</dt>
          <dd className="min-w-0 text-right font-semibold text-black wrap-anywhere">{resumen.servicio_nombre}</dd>
        </div>
      )}
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Barbero</dt>
        <dd className="text-right font-semibold text-black">{resumen.barbero_nombre}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Fecha</dt>
        <dd className="text-right font-semibold text-black">{formatearFechaLegible(resumen.fecha)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Hora</dt>
        <dd className="text-right font-semibold text-black">{String(resumen.hora).slice(0, 5)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-zinc-500">Duración</dt>
        <dd className="text-right font-semibold text-black">
          {esCombo ? formatearDuracion(resumen.duracion_min) : `${resumen.duracion_min} min`}
        </dd>
      </div>
      <div className="mt-1 flex justify-between gap-2 border-t border-zinc-200 pt-2">
        <dt className="text-zinc-500">Total</dt>
        <dd className="text-right font-bold text-black">{formatearPrecio(resumen.precio)}</dd>
      </div>
    </dl>

    <button
      type="button"
      onClick={onNuevaReserva}
      className="mt-4 rounded-xl bg-[#D4AF37] px-6 py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-[#D4AF37]"
    >
      Agendar otra cita
    </button>
  </div>
  )
}

export default PantallaExito
