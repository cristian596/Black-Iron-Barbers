import { Link } from 'react-router-dom'
import AvatarBarbero from '../../ui/AvatarBarbero'
import { enlaceReserva } from '../../../utils/equipo'

// Tarjeta editorial de la galería del equipo (propia de esta sección: TarjetaBarbero queda como estaba).
// Foto 4:5 a sangre completa con degradado inferior. En móvil, táctil y pantallas < 1024 px el botón va siempre
// visible bajo la foto; con puntero fino desde lg se superpone y aparece al pasar el ratón o al enfocar (focus-within),
// y el texto sube para dejarle sitio.
const TarjetaEquipo = ({ barbero, entrada = false }) => (
  <article
    className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-lg shadow-black/40 motion-safe:transition-[translate,border-color,box-shadow] motion-safe:duration-300 hover:border-oro/70 focus-within:border-oro motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1 hover:shadow-oro/10 ${
      entrada ? 'motion-safe:animate-hero-entrada' : ''
    }`}
  >
    <div className="relative aspect-4/5 w-full shrink-0 overflow-hidden">
      <AvatarBarbero
        barbero={barbero}
        descripcion={barbero.cargo}
        ancho={640}
        alto={800}
        variante="premium"
        textoClase="text-3xl sm:text-5xl"
        className="absolute inset-0 size-full object-[50%_20%] motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black via-black/70 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1.5 p-3 sm:p-4 motion-safe:transition-transform motion-safe:duration-300 lg:pointer-fine:group-hover:-translate-y-14 lg:pointer-fine:group-focus-within:-translate-y-14">
        <h3 className="wrap-anywhere font-playfair text-lg leading-tight font-semibold text-white sm:text-xl">{barbero.nombre}</h3>
        {barbero.cargo && (
          <p className="wrap-anywhere font-poppins text-[0.65rem] font-semibold tracking-[0.12em] text-oro uppercase sm:text-[0.7rem] sm:tracking-[0.18em]">{barbero.cargo}</p>
        )}
        {barbero.especialidad && (
          <p className="max-w-full truncate rounded-full border border-white/25 bg-black/50 px-2.5 py-0.5 font-poppins text-[0.7rem] text-zinc-100 sm:text-xs">
            {barbero.especialidad}
          </p>
        )}
      </div>
    </div>

    <Link
      to={enlaceReserva(barbero)}
      className="flex min-h-11 w-full grow items-center justify-center bg-oro px-3 py-2 text-center font-poppins text-sm font-semibold wrap-anywhere text-black hover:bg-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white motion-safe:transition-colors motion-safe:duration-200 lg:pointer-fine:absolute lg:pointer-fine:inset-x-3 lg:pointer-fine:bottom-3 lg:pointer-fine:w-auto lg:pointer-fine:rounded-full lg:pointer-fine:opacity-0 lg:pointer-fine:group-hover:opacity-100 lg:pointer-fine:focus-visible:opacity-100 lg:pointer-fine:group-focus-within:opacity-100 motion-safe:lg:pointer-fine:transition-opacity"
    >
      Reservar con {barbero.nombre}
    </Link>
  </article>
)

// Esqueleto con la misma forma que la tarjeta (foto 4:5 + franja del botón).
export const EsqueletoTarjetaEquipo = () => (
  <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
    <div className="aspect-4/5 w-full bg-zinc-800 motion-safe:animate-pulse" />
    <div className="h-11 w-full bg-zinc-800/70 motion-safe:animate-pulse lg:pointer-fine:hidden" />
  </div>
)

export default TarjetaEquipo
