import { Link, useLocation } from 'react-router-dom'
import { FaFacebookF, FaInstagram, FaTiktok } from 'react-icons/fa'
import { RiScissorsCutFill } from 'react-icons/ri'
import BotonAcento from '../ui/BotonAcento'
import {
  NOMBRE_NEGOCIO,
  contacto,
  HORARIO_ATENCION,
  REDES_SOCIALES,
  enlaceMapa,
  enlaceWhatsApp,
  hayWhatsAppReal,
  MENSAJE_WHATSAPP_GENERAL,
} from '../../data/negocio'

const ICONOS_RED = { facebook: FaFacebookF, instagram: FaInstagram, tiktok: FaTiktok }

const NAVEGACION = [
  { to: '/', texto: 'Inicio' },
  { to: '/cortes', texto: 'Servicios y precios' },
  { to: '/asesorias', texto: 'Asesorías' },
  { to: '/#equipo', texto: 'Nuestro equipo' },
  { to: '/reservar-corte', texto: 'Reservar' },
]

const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro'
const ENLACE = `inline-flex min-h-11 items-center gap-3 text-zinc-300 duration-200 hover:text-oro motion-reduce:transition-none ${FOCO}`
const TITULO = 'mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-oro'

// Iconos de contacto en SVG propio (decorativos).
const Icono = ({ children }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5 shrink-0 text-oro"
  >
    {children}
  </svg>
)

const IconoUbicacion = () => (
  <Icono>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icono>
)
const IconoWhatsApp = () => (
  <Icono>
    <path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8L4 20Z" />
    <path d="M9 9.5c.3 2.2 2.3 4.2 5 5l1.2-1.3-1.8-.9-.8.6c-.8-.4-1.6-1.2-2-2l.6-.8-.9-1.8L9 9.5Z" />
  </Icono>
)
const IconoCorreo = () => (
  <Icono>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Icono>
)

const EnlaceRed = ({ red }) => {
  const Logo = ICONOS_RED[red.id]
  const provisional = red.url === '#'
  return (
    <a
      href={red.url}
      aria-label={`${red.nombre} de ${NOMBRE_NEGOCIO}`}
      // Mientras no haya URL real, el clic no debe llevar al inicio de la página.
      onClick={provisional ? (e) => e.preventDefault() : undefined}
      {...(provisional ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      className={`flex size-11 items-center justify-center rounded-xl border border-zinc-600 text-zinc-300 duration-200 hover:border-oro hover:text-oro active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCO}`}
    >
      <Logo aria-hidden="true" size={18} />
    </a>
  )
}

const volverArriba = () => {
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  window.scrollTo({ top: 0, behavior: reducido ? 'auto' : 'smooth' })
}

// Pie de página público (solo lo monta Landingpage: el panel y el admin no lo usan).
const Footer = ({ redes = REDES_SOCIALES }) => {
  const { pathname } = useLocation()
  // En la reserva el cliente ya está reservando: sin banda de llamada a la acción.
  const mostrarBanda = pathname.replace(/\/+$/, '') !== '/reservar-corte'

  return (
    <>
      {mostrarBanda && (
        <section
          aria-labelledby="titulo-banda-cta"
          className="bg-linear-to-b from-black to-[#141414] px-4 py-12 text-center sm:px-10 lg:py-16"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
            <h2
              id="titulo-banda-cta"
              className="font-playfair text-[clamp(1.5rem,1rem+2vw,2.5rem)] font-bold leading-tight text-white"
            >
              ¿Listo para tu próximo corte?
            </h2>
            <p className="max-w-prose text-base text-zinc-300">Elige tu servicio y tu hora en pocos minutos.</p>
            <BotonAcento to="/reservar-corte" className="mt-3">
              RESERVA TU EXPERIENCIA
            </BotonAcento>
            <Link
              to="/asesorias#gratis"
              className={`inline-flex min-h-11 items-center text-sm text-zinc-300 underline decoration-oro/60 underline-offset-4 duration-200 hover:text-oro motion-reduce:transition-none ${FOCO}`}
            >
              ¿Primera vez? Tu primera asesoría es gratis
            </Link>
          </div>
        </section>
      )}

      {/* El padding inferior deja libres el botón de WhatsApp, el de Inicio y la barra del carrito (fijos). */}
      <footer className="border-t border-oro/50 bg-[#141414] px-4 pt-12 pb-36 text-zinc-300 sm:px-10 min-[1440px]:pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <div className="flex flex-col items-start gap-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-white">
                <RiScissorsCutFill aria-hidden="true" className="rounded-full bg-[#f7f4ef] p-1 text-black" size={28} />
                {NOMBRE_NEGOCIO}
              </p>
              <p className="font-playfair text-xl italic leading-snug text-oro">No es solo un corte. Es tu firma.</p>
              <ul className="flex flex-wrap gap-3">
                {redes.map((red) => (
                  <li key={red.id}>
                    <EnlaceRed red={red} />
                  </li>
                ))}
              </ul>
            </div>

            <nav aria-label="Pie de página">
              <h2 className={TITULO}>Navegación</h2>
              <ul>
                {NAVEGACION.map(({ to, texto }) => (
                  <li key={to}>
                    <Link to={to} className={ENLACE}>
                      {texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className={TITULO}>Horario</h2>
              <p className="text-white">{HORARIO_ATENCION.dias}</p>
              <p>{HORARIO_ATENCION.texto}</p>
            </div>

            <div>
              <h2 className={TITULO}>Contacto</h2>
              <ul>
                <li>
                  <a href={enlaceMapa(contacto.direccion)} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                    <IconoUbicacion />
                    {contacto.direccion}
                  </a>
                </li>
                {hayWhatsAppReal() && (
                  <li>
                    <a
                      href={enlaceWhatsApp(MENSAJE_WHATSAPP_GENERAL)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ENLACE}
                    >
                      <IconoWhatsApp />
                      Escríbenos por WhatsApp
                    </a>
                  </li>
                )}
                <li>
                  <a href={`mailto:${contacto.correo}`} className={`${ENLACE} break-all`}>
                    <IconoCorreo />
                    {contacto.correo}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm md:flex-row md:items-center md:justify-between">
            <p className="font-semibold text-zinc-200">El corte cambia. La filosofía nunca.</p>
            <p>
              &copy; {new Date().getFullYear()} {NOMBRE_NEGOCIO} — Todos los derechos reservados
            </p>
            <button
              type="button"
              onClick={volverArriba}
              className={`inline-flex min-h-11 cursor-pointer items-center self-start text-zinc-300 underline decoration-oro/60 underline-offset-4 duration-200 hover:text-oro motion-reduce:transition-none md:self-auto ${FOCO}`}
            >
              Volver arriba
            </button>
          </div>
        </div>
      </footer>
    </>
  )
}

export default Footer
