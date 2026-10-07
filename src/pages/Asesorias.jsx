import { Link } from 'react-router-dom'
import { ASESORIAS } from '../data/asesorias'
import { useScrollAHash } from '../hooks/useScrollAHash'
import { useTitulo } from '../hooks/useTitulo'
import ResumenAsesorias from '../components/sections/asesorias/ResumenAsesorias'
import SeccionAsesoria from '../components/sections/asesorias/SeccionAsesoria'

const IDS = ASESORIAS.map((a) => a.id)

const Asesorias = () => {
  useTitulo(
    'Asesorías de imagen | Black Iron Barbers',
    'Asesoría de imagen gratis, Asesoría Premium y asesoría de barba en Black Iron Barbers: descubre el estilo que mejor va contigo.'
  )
  useScrollAHash(IDS)

  return (
    <div className="bg-black text-white">
      <section className="px-4 py-16 text-center md:py-24">
        <p className="font-poppins text-xs font-semibold uppercase tracking-[0.3em] text-oro">Para clientes nuevos</p>
        <h1 className="mx-auto mt-3 max-w-3xl font-cinzel text-4xl font-bold wrap-anywhere motion-safe:animate-hero-entrada md:text-6xl">
          Asesorías de imagen
        </h1>
        <div aria-hidden="true" className="mx-auto mt-6 h-px w-24 bg-oro" />
        <p className="mx-auto mt-6 max-w-2xl font-poppins text-base text-zinc-300 md:text-lg">
          Antes de sentarte en la silla, conversemos. Elige la asesoría que va con lo que buscas y sal con un estilo
          pensado para ti.
        </p>
      </section>

      <ResumenAsesorias />

      {ASESORIAS.map((asesoria, i) => (
        <SeccionAsesoria key={asesoria.id} asesoria={asesoria} indice={i} />
      ))}

      <div className="border-t border-oro/20 px-4 py-12 text-center">
        <Link
          to="/reservar-corte"
          className="inline-flex min-h-11 items-center rounded px-3 font-poppins text-base text-zinc-300 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro"
        >
          Solo quiero reservar mi corte
        </Link>
      </div>
    </div>
  )
}

export default Asesorias
