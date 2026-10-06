import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiChevronUp, FiX } from 'react-icons/fi'
import { useCarrito } from '../../context/CarritoContext'
import { useAtraparFoco } from '../../hooks/useAtraparFoco'
import { formatearPrecio } from '../../utils/formato'
import { enlaceReservaSeleccion, precioTotal, textoServicios } from '../../utils/carrito'
import ContenidoCarrito from './ContenidoCarrito'

// "Tu selección". Escritorio (lg+): tarjeta pegajosa a la derecha. Móvil: barra fija inferior (contador y total) que
// abre un panel deslizable desde abajo. Capas: la barra va en z-40 (bajo el menú, el botón de WhatsApp y el de Inicio,
// que son z-50) y mide h-16 para que esos botones, que flotan justo encima, no la tapen; el panel va en z-55: por
// encima de ellos y de la barra de navegación, pero bajo el menú móvil (z-60/70).
const CarritoServicios = () => {
  const { ids, seleccion, aviso, quitar, vaciar, revalidar, descartarAviso } = useCarrito()
  const [abierto, setAbierto] = useState(false)
  const idTitulo = useId()
  const panelRef = useRef(null)
  const botonRef = useRef(null)

  const cerrar = () => {
    setAbierto(false)
    botonRef.current?.focus()
  }
  // Foco atrapado, Escape cierra, el fondo no hace scroll y, al cerrar, el foco vuelve al botón que lo abrió.
  useAtraparFoco(panelRef, abierto, cerrar)

  // Al abrir el panel se vuelve a validar la selección contra el catálogo.
  useEffect(() => {
    if (abierto) revalidar()
  }, [abierto, revalidar])

  // Si el panel se queda sin servicios, se cierra (salvo que haya un aviso que mostrar).
  const alQuitar = (id) => {
    if (ids.length <= 1) setAbierto(false)
    quitar(id)
  }
  const alVaciar = () => {
    setAbierto(false)
    vaciar()
  }

  const n = seleccion.length

  return (
    <>
      <aside
        aria-label="Tu selección"
        className="hidden min-w-0 rounded-2xl border border-oro/40 bg-zinc-950 p-5 text-white shadow-xl lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
      >
        <h2 className="mb-3 font-cinzel text-2xl font-bold text-oro">Tu selección</h2>
        <ContenidoCarrito
          seleccion={seleccion}
          aviso={aviso}
          onQuitar={quitar}
          onVaciar={vaciar}
          onDescartarAviso={descartarAviso}
        />
      </aside>

      {n > 0 && (
        <div
          role="region"
          aria-label="Resumen de tu selección"
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center gap-2 border-t border-oro/40 bg-zinc-950 px-3 text-white shadow-[0_-2px_8px_rgba(0,0,0,0.4)] lg:hidden"
        >
          <button
            ref={botonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={abierto}
            onClick={() => setAbierto(true)}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2 text-left font-poppins focus-visible:outline-2 focus-visible:outline-oro"
          >
            <FiChevronUp aria-hidden="true" className="shrink-0 text-oro" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                Tu selección · {textoServicios(n)}
              </span>
              <span className="block font-cinzel text-base font-bold text-oro">{formatearPrecio(precioTotal(seleccion))}</span>
            </span>
          </button>
          <Link
            to={enlaceReservaSeleccion(seleccion.map((s) => s.id))}
            className="flex min-h-11 shrink-0 items-center rounded-xl bg-oro px-4 font-cinzel font-bold text-black active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Agendar
          </Link>
          {/* Anuncia los cambios del contador y del total sin repetir la barra entera. */}
          <span role="status" aria-live="polite" className="sr-only">
            {textoServicios(n)} en tu selección. Total {formatearPrecio(precioTotal(seleccion))}.
          </span>
        </div>
      )}

      {abierto && (
        <div className="fixed inset-0 z-55 lg:hidden">
          <div className="absolute inset-0 bg-black/70" aria-hidden="true" onMouseDown={cerrar} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-oro/40 bg-zinc-950 p-5 pb-8 text-white motion-safe:animate-hero-entrada"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id={idTitulo} className="font-cinzel text-2xl font-bold text-oro">
                Tu selección
              </h2>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar tu selección"
                className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
            <ContenidoCarrito
              seleccion={seleccion}
              aviso={aviso}
              onQuitar={alQuitar}
              onVaciar={alVaciar}
              onDescartarAviso={descartarAviso}
              onAgendar={() => setAbierto(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default CarritoServicios
