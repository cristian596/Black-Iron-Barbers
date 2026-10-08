import { formatearFechaLegible } from '../../../utils/fechas'
import { formatearDuracion, formatearPrecio } from '../../../utils/formato'
import { TITULO_CITA, horaDeMinutos, minutosDeHora, normalizarReserva } from '../../../utils/reservaAsesoria'
import ListaServiciosReserva from './ListaServiciosReserva'

const Fila = ({ etiqueta, children, fuerte = false }) => (
  <div className="flex justify-between gap-2">
    <dt className="shrink-0 text-zinc-500">{etiqueta}</dt>
    <dd className={`min-w-0 text-right text-black wrap-anywhere ${fuerte ? 'font-bold' : 'font-semibold'}`}>{children}</dd>
  </div>
)

const hhmm = (hora) => String(hora).slice(0, 5)

// `resumen` es la respuesta de POST /api/citas: una cita plana (con varios servicios trae `servicios`, y `duracion_min`
// y `precio` ya son los totales) o, en una reserva con asesoría + barbería, { reserva_id, citas: [asesoría, barbería] }.
// `areaUnica`: de qué área es la cita cuando hay una sola ('asesoria' cambia "Barbero" por "Asesor/a").
const PantallaExito = ({ resumen, onNuevaReserva, areaUnica = 'barberia' }) => {
  const { citas } = normalizarReserva(resumen)
  const combinada = citas.length > 1
  const total = citas.reduce((suma, cita) => suma + cita.precio, 0)
  const duracion = citas.reduce((suma, cita) => suma + cita.duracion_min, 0)

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-oro3xl font-bold text-black"
      >
        ✓
      </span>
      <h1 className="font-cinzel text-3xl font-semibold text-black">
        {combinada ? '¡Citas agendadas con éxito!' : '¡Cita agendada con éxito!'}
      </h1>
      <p className="font-poppins text-zinc-600">Te esperamos en Black Iron Barbers.</p>

      {combinada ? (
        <div className="mt-2 w-full max-w-sm space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-left font-poppins text-sm shadow-sm">
          <p className="text-zinc-600">Primero tu asesoría y, justo al terminar, tu servicio de barbería.</p>
          {citas.map((cita, indice) => {
            const clave = indice === 0 ? 'asesoria' : 'barberia'
            const fin = horaDeMinutos(minutosDeHora(cita.hora) + cita.duracion_min)
            const varios = Array.isArray(cita.servicios) && cita.servicios.length > 1
            return (
              <section key={cita.id} aria-label={TITULO_CITA[clave]} className="rounded-lg border border-zinc-200 p-3">
                <h2 className="font-cinzel text-base font-bold text-black">
                  {TITULO_CITA[clave]} · {hhmm(cita.hora)} – {fin}
                </h2>
                <dl className="mt-2 space-y-1">
                  {varios ? (
                    <div>
                      <dt className="text-zinc-500">Servicios</dt>
                      <dd className="mt-1 font-semibold text-black">
                        <ListaServiciosReserva servicios={cita.servicios} conPrecio />
                      </dd>
                    </div>
                  ) : (
                    <Fila etiqueta="Servicio">{cita.servicio_nombre}</Fila>
                  )}
                  <Fila etiqueta={clave === 'asesoria' ? 'Asesor/a' : 'Barbero'}>{cita.barbero_nombre}</Fila>
                  <Fila etiqueta="Precio">{formatearPrecio(cita.precio)}</Fila>
                </dl>
              </section>
            )
          })}
          <dl className="space-y-1">
            <Fila etiqueta="Fecha">{formatearFechaLegible(citas[0].fecha)}</Fila>
            <Fila etiqueta="Duración total">{formatearDuracion(duracion)}</Fila>
            <div className="mt-1 border-t border-zinc-200 pt-2">
              <Fila etiqueta="Total" fuerte>
                {formatearPrecio(total)}
              </Fila>
            </div>
          </dl>
        </div>
      ) : (
        <dl className="mt-2 w-full max-w-sm space-y-1 rounded-2xl border border-zinc-200 bg-white p-5 text-left font-poppins text-sm shadow-sm">
          {Array.isArray(citas[0].servicios) && citas[0].servicios.length > 1 ? (
            <div>
              <dt className="text-zinc-500">Servicios</dt>
              <dd className="mt-1 font-semibold text-black">
                <ListaServiciosReserva servicios={citas[0].servicios} conPrecio />
              </dd>
            </div>
          ) : (
            <Fila etiqueta="Servicio">{citas[0].servicio_nombre}</Fila>
          )}
          <Fila etiqueta={areaUnica === 'asesoria' ? 'Asesor/a' : 'Barbero'}>{citas[0].barbero_nombre}</Fila>
          <Fila etiqueta="Fecha">{formatearFechaLegible(citas[0].fecha)}</Fila>
          <Fila etiqueta="Hora">{hhmm(citas[0].hora)}</Fila>
          <Fila etiqueta="Duración">
            {Array.isArray(citas[0].servicios) && citas[0].servicios.length > 1
              ? formatearDuracion(citas[0].duracion_min)
              : `${citas[0].duracion_min} min`}
          </Fila>
          <div className="mt-1 border-t border-zinc-200 pt-2">
            <Fila etiqueta="Total" fuerte>
              {formatearPrecio(citas[0].precio)}
            </Fila>
          </div>
        </dl>
      )}

      <button
        type="button"
        onClick={onNuevaReserva}
        className="mt-4 min-h-11 rounded-xl bg-oro px-6 py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-oro"
      >
        Agendar otra cita
      </button>
    </div>
  )
}

export default PantallaExito
