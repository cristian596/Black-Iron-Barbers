import { formatearFechaLegible } from '../../../utils/fechas'
import { formatearPrecio } from '../../../utils/formato'

const CampoResumen = ({ etiqueta, valor }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-zinc-500">{etiqueta}</dt>
    <dd className="text-right font-semibold text-black">{valor}</dd>
  </div>
)

const Contenido = ({ servicio, barbero, mostrarBarbero, fecha, hora }) => (
  <dl className="space-y-2 font-poppins text-sm">
    {servicio ? (
      <CampoResumen etiqueta="Servicio" valor={servicio.nombre} />
    ) : (
      <p className="font-poppins text-sm text-zinc-400">Elige un servicio para empezar.</p>
    )}
    {servicio && mostrarBarbero && (
      <CampoResumen etiqueta="Barbero" valor={barbero ? barbero.nombre : 'Cualquier barbero'} />
    )}
    {fecha && <CampoResumen etiqueta="Fecha" valor={formatearFechaLegible(fecha)} />}
    {hora && <CampoResumen etiqueta="Hora" valor={hora} />}
  </dl>
)

// Un único componente para el panel lateral (escritorio) y la barra inferior fija
// (móvil): ambos reciben los mismos datos y el mismo botón "Continuar"; Tailwind
// decide cuál se muestra según el ancho de pantalla, sin duplicar la lógica.
const ResumenReserva = ({ servicio, barbero, mostrarBarbero, fecha, hora, onContinuar, puedeContinuar }) => {
  const total = servicio ? servicio.precio : null

  return (
    <>
      <aside className="hidden w-72 shrink-0 lg:block" aria-label="Resumen de la reserva">
        <div className="sticky top-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-cinzel text-lg font-bold text-black">Resumen</h2>
          <div className="mt-3">
            <Contenido servicio={servicio} barbero={barbero} mostrarBarbero={mostrarBarbero} fecha={fecha} hora={hora} />
          </div>

          {servicio && (
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 font-cinzel font-bold text-black">
              <span>Total</span>
              <span>{formatearPrecio(total)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onContinuar}
            disabled={!puedeContinuar}
            className="mt-4 w-full rounded-xl bg-[#D4AF37] py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#D4AF37] disabled:hover:text-black"
          >
            Continuar
          </button>
        </div>
      </aside>

      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] lg:hidden"
        aria-label="Resumen de la reserva"
      >
        <div className="font-poppins">
          <p className="text-xs text-zinc-500">Total</p>
          <p className="font-cinzel text-lg font-bold text-black">
            {total !== null ? formatearPrecio(total) : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={onContinuar}
          disabled={!puedeContinuar}
          className="rounded-xl bg-[#D4AF37] px-6 py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#D4AF37] disabled:hover:text-black"
        >
          Continuar
        </button>
      </div>
    </>
  )
}

export default ResumenReserva
