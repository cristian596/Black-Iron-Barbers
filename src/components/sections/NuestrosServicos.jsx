import { Fragment } from 'react'
import BotonAcento from '../ui/BotonAcento'
import Revelar from '../ui/Revelar'
import { PIE_SERVICIOS } from '../../data/experiencia'

const NuestrosServicos = () => {
  return (
    <section aria-labelledby="titulo-servicios-home" className="relative overflow-hidden bg-black">
      {/* Foto decorativa: el degradado oscuro garantiza el contraste del texto en todo el ancho */}
      <img
        src="/CourtMan/barberia.jpg"
        alt=""
        width={768}
        height={432}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover object-[50%_75%]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-black/85 via-black/75 to-black/90" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-10 lg:py-28">
        <Revelar className="flex flex-col items-center gap-5">
          <p className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-oro">
            <span aria-hidden="true" className="h-px w-10 bg-oro" />
            NUESTROS SERVICIOS
            <span aria-hidden="true" className="h-px w-10 bg-oro" />
          </p>
          <h2
            id="titulo-servicios-home"
            className="font-playfair text-[clamp(1.875rem,1.2rem+3.5vw,3.75rem)] font-bold leading-tight text-white"
          >
            Tu estilo comienza con los detalles.
          </h2>
          <p className="max-w-prose text-base leading-relaxed text-zinc-200 md:text-lg">
            En Black Iron hemos creado una selección de servicios pensados para cuidar tu imagen y hacer que cada visita
            sea una experiencia diferente. Desde cortes clásicos y modernos hasta el cuidado de tu barba, encuentra el
            servicio que mejor representa tu estilo.
          </p>
        </Revelar>

        <Revelar retraso={120} className="flex flex-col items-center gap-6">
          <BotonAcento to="/cortes">VER SERVICIOS Y PRECIOS</BotonAcento>
          <p className="flex flex-wrap items-center justify-center gap-x-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-300">
            {PIE_SERVICIOS.map((palabra, i) => (
              <Fragment key={palabra}>
                {i > 0 && (
                  <span aria-hidden="true" className="text-oro">
                    ·
                  </span>
                )}
                <span>{palabra}</span>
              </Fragment>
            ))}
          </p>
        </Revelar>
      </div>
    </section>
  )
}

export default NuestrosServicos
