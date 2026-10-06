import { Link } from 'react-router-dom'
import { FiX } from 'react-icons/fi'
import { FcClock } from 'react-icons/fc'
import { formatearDuracion, formatearPrecio } from '../../utils/formato'
import {
  MAX_SERVICIOS,
  categoriasRepetidas,
  duracionTotal,
  enlaceReservaSeleccion,
  precioTotal,
  textoServicios,
} from '../../utils/carrito'

// Aviso de que se quitaron servicios que ya no están disponibles. Se anuncia con aria-live y se puede cerrar.
export const AvisoSeleccion = ({ aviso, onDescartar, className = '' }) =>
  aviso ? (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 rounded-xl border border-oro bg-zinc-950 p-3 font-poppins text-sm text-white ${className}`}
    >
      <p className="min-w-0 flex-1">{aviso}</p>
      <button
        type="button"
        onClick={onDescartar}
        aria-label="Cerrar aviso"
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-oro"
      >
        <FiX aria-hidden="true" />
      </button>
    </div>
  ) : null

const BOTON_AGENDAR =
  'mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-oro px-4 py-2 text-center font-cinzel font-bold text-black duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95'

// Contenido de "Tu selección", compartido por la tarjeta de escritorio y el panel móvil: lista con botón quitar,
// tiempo total, total, aviso suave de categoría repetida, "Agendar" y "Vaciar selección".
const ContenidoCarrito = ({ seleccion, aviso, onQuitar, onVaciar, onDescartarAviso, onAgendar }) => {
  const n = seleccion.length
  const repetidas = categoriasRepetidas(seleccion)

  return (
    <div className="font-poppins">
      <AvisoSeleccion aviso={aviso} onDescartar={onDescartarAviso} className="mb-3" />

      {n === 0 && (
        <p className="text-sm text-zinc-300">
          Aún no has elegido servicios. Agrega hasta {MAX_SERVICIOS} con «Agregar a mi selección» y agéndalos en una sola cita.
        </p>
      )}

      {n > 0 && (
        <ul className="divide-y divide-white/10">
          {seleccion.map((servicio) => (
            <li key={servicio.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{servicio.nombre}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-zinc-300">
                  <span className="flex items-center gap-1">
                    <FcClock aria-hidden="true" />
                    {formatearDuracion(servicio.duracion_min)}
                  </span>
                  <span>{formatearPrecio(servicio.precio)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onQuitar(servicio.id)}
                aria-label={`Quitar ${servicio.nombre} de mi selección`}
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
              >
                <FiX aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Siempre montada: solo cambia su texto, así el lector de pantalla anuncia únicamente los cambios. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
        <p className="text-zinc-300">
          {n === 0 ? `0 de ${MAX_SERVICIOS} servicios` : `${textoServicios(n)} de ${MAX_SERVICIOS}`}
        </p>
        {n > 0 && (
          <>
            <p className="flex justify-between gap-2 text-zinc-300">
              <span>Tiempo total</span>
              <span className="font-semibold text-white">{formatearDuracion(duracionTotal(seleccion))}</span>
            </p>
            <p className="flex justify-between gap-2 font-cinzel text-lg font-bold text-oro">
              <span>Total</span>
              <span>{formatearPrecio(precioTotal(seleccion))}</span>
            </p>
          </>
        )}
      </div>

      {repetidas.map((categoria) => (
        <p key={categoria} className="mt-2 rounded-lg bg-white/10 p-2 text-sm text-zinc-200">
          Ya tienes un servicio de {categoria}; puedes continuar si quieres ambos.
        </p>
      ))}

      {n > 0 && (
        <>
          <Link to={enlaceReservaSeleccion(seleccion.map((s) => s.id))} onClick={onAgendar} className={BOTON_AGENDAR}>
            Agendar {textoServicios(n)}
          </Link>
          <button
            type="button"
            onClick={onVaciar}
            className="mx-auto mt-1 flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-zinc-300 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
          >
            Vaciar selección
          </button>
        </>
      )}

      <p className="mt-2 text-center text-xs text-zinc-400">Agenda ahora y paga en sitio</p>
    </div>
  )
}

export default ContenidoCarrito
