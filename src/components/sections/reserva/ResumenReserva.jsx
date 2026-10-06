import { formatearFechaLegible } from '../../../utils/fechas'
import { formatearDuracion, formatearPrecio } from '../../../utils/formato'
import { duracionTotal, precioTotal, textoServicios } from '../../../utils/carrito'
import ListaServiciosReserva from './ListaServiciosReserva'

const CampoResumen = ({ etiqueta, valor }) => (
  <div className="flex justify-between gap-2">
    <dt className="shrink-0 text-zinc-500">{etiqueta}</dt>
    <dd className="min-w-0 text-right font-semibold text-black wrap-anywhere">{valor}</dd>
  </div>
)

const Contenido = ({ servicios, barbero, mostrarBarbero, fecha, hora }) => (
  <dl className="space-y-2 font-poppins text-sm">
    {servicios.length === 0 && <p className="font-poppins text-sm text-zinc-400">Elige un servicio para empezar.</p>}
    {servicios.length === 1 && <CampoResumen etiqueta="Servicio" valor={servicios[0].nombre} />}
    {servicios.length > 1 && (
      <div>
        <dt className="text-zinc-500">Servicios</dt>
        <dd className="mt-1 font-semibold text-black">
          <ListaServiciosReserva servicios={servicios} />
        </dd>
      </div>
    )}
    {servicios.length > 1 && <CampoResumen etiqueta="Duración total" valor={formatearDuracion(duracionTotal(servicios))} />}
    {servicios.length > 0 && mostrarBarbero && (
      <CampoResumen etiqueta="Barbero" valor={barbero ? barbero.nombre : 'Cualquier barbero'} />
    )}
    {fecha && <CampoResumen etiqueta="Fecha" valor={formatearFechaLegible(fecha)} />}
    {hora && <CampoResumen etiqueta="Hora" valor={hora} />}
  </dl>
)

// Un único componente para el panel lateral (escritorio) y la barra inferior fija
// (móvil): ambos reciben los mismos datos y el mismo botón "Continuar"; Tailwind
// decide cuál se muestra según el ancho de pantalla, sin duplicar la lógica.
// `servicios`: los servicios elegidos (objetos del catálogo), en orden; el total es la suma de sus precios.
const ResumenReserva = ({ servicios, barbero, mostrarBarbero, fecha, hora, onContinuar, puedeContinuar }) => {
  const total = servicios.length > 0 ? precioTotal(servicios) : null

  return (
    <>
      <aside className="hidden w-72 shrink-0 lg:block" aria-label="Resumen de la reserva">
        <div className="sticky top-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-cinzel text-lg font-bold text-black">Resumen</h2>
          <div className="mt-3">
            <Contenido servicios={servicios} barbero={barbero} mostrarBarbero={mostrarBarbero} fecha={fecha} hora={hora} />
          </div>

          {servicios.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 font-cinzel font-bold text-black">
              <span>Total</span>
              <span>{formatearPrecio(total)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onContinuar}
            disabled={!puedeContinuar}
            className="mt-4 min-h-11 w-full rounded-xl bg-oro py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-oro disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-oro disabled:hover:text-black"
          >
            Continuar
          </button>
        </div>
      </aside>

      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-zinc-200 bg-white px-4 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] lg:hidden"
        aria-label="Resumen de la reserva"
      >
        <div className="min-w-0 font-poppins">
          <p className="truncate text-xs text-zinc-500">
            Total{servicios.length > 1 ? ` · ${textoServicios(servicios.length)} · ${formatearDuracion(duracionTotal(servicios))}` : ''}
          </p>
          <p className="font-cinzel text-lg font-bold text-black">
            {total !== null ? formatearPrecio(total) : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={onContinuar}
          disabled={!puedeContinuar}
          className="min-h-11 shrink-0 rounded-xl bg-oro px-6 py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-oro disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-oro disabled:hover:text-black"
        >
          Continuar
        </button>
      </div>
    </>
  )
}

export default ResumenReserva
