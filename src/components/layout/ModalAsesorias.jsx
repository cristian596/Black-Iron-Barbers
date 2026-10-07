import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaArrowRight } from 'react-icons/fa'
import Modal from '../ui/Modal'
import { ASESORIAS, rutaAsesoria } from '../../data/asesorias'
import { formatearDuracion, formatearPrecio } from '../../utils/formato'

const ID_TITULO = 'titulo-modal-asesorias'

const foco = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro'

// Modal de bienvenida para quien llega por primera vez. Solo se abre con el clic del botón "Soy cliente nuevo".
// `alCerrar`: cierre voluntario (el foco vuelve al botón). `alNavegar`: se cierra porque se va a otra página
// (el foco lo decide el destino). También se cierra solo si cambia la ubicación (p. ej. botón Atrás).
const ModalAsesorias = ({ alCerrar, alNavegar }) => {
  const location = useLocation()
  const claveInicial = useRef(location.key)
  const navegarRef = useRef(alNavegar)

  useEffect(() => {
    navegarRef.current = alNavegar
  })

  useEffect(() => {
    if (location.key !== claveInicial.current) navegarRef.current?.()
  }, [location.key])

  return (
    <Modal
      idTitulo={ID_TITULO}
      alCerrar={alCerrar}
      capa="z-80"
      centrado
      claseCaja="max-w-5xl flex max-h-[90dvh] flex-col motion-safe:animate-[hero-entrada_0.3s_ease-out_both]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="pr-12 text-center lg:px-12">
          <p className="font-poppins text-xs font-semibold uppercase tracking-[0.3em] text-oro">Bienvenido</p>
          <h2 id={ID_TITULO} className="mt-2 font-cinzel text-2xl font-bold sm:text-3xl">
            ¿Primera vez en Black Iron?
          </h2>
          <p className="mx-auto mt-2 max-w-xl font-poppins text-sm text-zinc-400">
            Elige cómo quieres empezar: una conversación sobre tu imagen antes de sentarte en la silla.
          </p>
        </div>

        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {ASESORIAS.map(({ id, titulo, precio, duracion_min, resumen, Icono }) => (
            <li key={id} className="grid min-w-0">
              <Link
                to={rutaAsesoria(id)}
                onClick={alNavegar}
                className={`group flex min-h-11 min-w-0 flex-col gap-3 rounded-xl border bg-zinc-950 p-5 text-left duration-300 hover:-translate-y-0.5 hover:border-oro hover:bg-zinc-900 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 ${
                  precio === 0 ? 'border-oro/60' : 'border-white/10'
                } ${foco}`}
              >
                <Icono aria-hidden="true" size={28} className="shrink-0 text-oro" />
                <h3 className="font-playfair text-xl font-semibold wrap-anywhere">{titulo}</h3>
                <p
                  className={`w-fit rounded-full px-3 py-1 font-poppins text-xs font-semibold ${
                    precio === 0 ? 'bg-oro text-black' : 'border border-oro/50 text-oro'
                  }`}
                >
                  {precio === 0 ? 'GRATIS' : formatearPrecio(precio)} · {formatearDuracion(duracion_min)}
                </p>
                <p className="flex-1 font-poppins text-sm text-zinc-400">{resumen}</p>
                <span className="flex items-center gap-2 font-poppins text-sm font-medium text-oro">
                  Conocer más
                  <FaArrowRight
                    aria-hidden="true"
                    size={14}
                    className="duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 text-center">
          <Link
            to="/reservar-corte"
            onClick={alNavegar}
            className={`inline-flex min-h-11 items-center rounded px-3 font-poppins text-sm text-zinc-400 underline underline-offset-4 hover:text-white ${foco}`}
          >
            Solo quiero reservar mi corte
          </Link>
        </div>
      </div>
    </Modal>
  )
}

export default ModalAsesorias
