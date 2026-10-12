import { Link } from 'react-router-dom'
import BotonAcento from '../ui/BotonAcento'
import IconoExperiencia from '../ui/IconosExperiencia'
import Revelar from '../ui/Revelar'
import { BENEFICIOS_EXPERIENCIA } from '../../data/experiencia'

const FOTO = 'absolute h-4/5 w-[62%] rounded-2xl border-4 border-[#111111] object-cover shadow-2xl shadow-black/60'

const ComeAndTry = () => {
  return (
    <section
      aria-labelledby="titulo-experiencia"
      className="overflow-x-clip bg-linear-to-b from-[#141414] to-black px-4 py-10 sm:px-10 md:py-14 lg:py-16"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 md:grid-cols-2 lg:gap-16 xl:gap-24">
        <Revelar variante="derecha" className="flex min-w-0 flex-col gap-5 text-white md:col-start-2 md:row-start-1">
          <p className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-oro">
            <span aria-hidden="true" className="h-px w-10 bg-oro" />
            MÁS QUE UNA BARBERÍA
          </p>
          <h2
            id="titulo-experiencia"
            className="font-playfair text-[clamp(1.875rem,1rem+2.6vw,3.75rem)] font-bold leading-tight"
          >
            Tu estilo merece una experiencia a otro nivel.
          </h2>
          <p className="max-w-[65ch] text-base leading-relaxed text-zinc-300 md:text-lg">
            En Black Iron creemos que un buen corte es solo el comienzo. Queremos que cada visita sea un momento para
            desconectarte de la rutina, disfrutar de un servicio profesional y salir con un estilo que realmente
            represente quién eres.
          </p>
          <ul className="flex max-w-[65ch] flex-col gap-4">
            {BENEFICIOS_EXPERIENCIA.map(({ icono, destacado, resto }) => (
              <li key={icono} className="flex items-start gap-4 text-base leading-relaxed text-zinc-300 lg:text-[1.0625rem]">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-oro/40 text-oro">
                  <IconoExperiencia nombre={icono} />
                </span>
                <span className="pt-2">
                  <strong className="font-semibold text-white">{destacado}</strong> {resto}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col items-start gap-1">
            <BotonAcento to="/reservar-corte">RESERVA TU EXPERIENCIA</BotonAcento>
            <Link
              to="/asesorias#gratis"
              className="inline-flex min-h-11 items-center text-sm text-zinc-300 underline decoration-oro/60 underline-offset-4 duration-200 hover:text-oro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro motion-reduce:transition-none"
            >
              ¿Primera vez? Tu primera asesoría es gratis
            </Link>
          </div>
        </Revelar>

        <Revelar variante="izquierda" className="min-w-0 md:col-start-1 md:row-start-1">
          <div className="relative mx-auto aspect-4/5 w-full max-w-md md:max-w-none">
            <div aria-hidden="true" className="pointer-events-none absolute -inset-10 bg-radial-[ellipse_closest-side_at_50%_50%] from-oro/20 via-oro/5 to-transparent" />
            <div aria-hidden="true" className="absolute left-0 top-0 h-4/5 w-[62%] -translate-x-3 -translate-y-3 rounded-2xl border border-oro/50" />
            <img
              className={`${FOTO} left-0 top-0`}
              src="/CourtMan/court_3.jpg"
              alt="Barbero realizando un corte de cabello en el local"
              width={564}
              height={797}
              loading="lazy"
              decoding="async"
            />
            <img
              className={`${FOTO} bottom-0 right-0`}
              src="/CourtMan/court_5.jpg"
              alt="Cliente recibiendo un servicio de barbería"
              width={736}
              height={770}
              loading="lazy"
              decoding="async"
            />
          </div>
        </Revelar>
      </div>
    </section>
  )
}

export default ComeAndTry
