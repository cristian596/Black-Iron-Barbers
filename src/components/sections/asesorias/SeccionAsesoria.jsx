import { FaCheck, FaWhatsapp } from 'react-icons/fa6'
import { enlaceWhatsApp } from '../../../data/negocio'
import EtiquetaAsesoria from './EtiquetaAsesoria'

const SeccionAsesoria = ({ asesoria, indice }) => {
  const { id, titulo, precio, duracion_min, Icono, descripcion, incluye, paraQuien, pasos, textoBoton, mensajeWhatsApp } =
    asesoria
  const idTitulo = `titulo-${id}`

  return (
    <section
      id={id}
      aria-labelledby={idTitulo}
      className={`scroll-mt-24 px-4 py-14 md:py-20 ${indice % 2 === 0 ? 'bg-zinc-950' : 'bg-[#0f0f0f]'}`}
    >
      <div className="mx-auto flex max-w-5xl min-w-0 flex-col gap-10">
        <div className="flex min-w-0 flex-col gap-4">
          <Icono aria-hidden="true" size={36} className="text-oro" />
          <h2
            id={idTitulo}
            tabIndex={-1}
            className="font-cinzel text-3xl font-bold text-white wrap-anywhere focus:outline-none md:text-4xl"
          >
            {titulo}
          </h2>
          <EtiquetaAsesoria precio={precio} duracion_min={duracion_min} />
          <p className="max-w-3xl font-poppins text-base text-zinc-300 md:text-lg">{descripcion}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/40 p-6">
            <h3 className="font-playfair text-xl font-semibold text-oro">Qué incluye</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {incluye.map((item) => (
                <li key={item} className="flex min-w-0 items-start gap-3 font-poppins text-sm text-zinc-300">
                  <FaCheck aria-hidden="true" size={14} className="mt-1 shrink-0 text-oro" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/40 p-6">
            <h3 className="font-playfair text-xl font-semibold text-oro">Para quién es</h3>
            <p className="mt-4 font-poppins text-sm text-zinc-300">{paraQuien}</p>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="font-playfair text-xl font-semibold text-oro">Cómo funciona</h3>
          <ol className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {pasos.map(({ titulo: tituloPaso, texto }, i) => (
              <li key={tituloPaso} className="flex min-w-0 gap-4 rounded-2xl border border-white/10 bg-black/40 p-5">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-oro/60 font-cinzel text-lg font-bold text-oro"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h4 className="font-poppins text-base font-semibold text-white">{tituloPaso}</h4>
                  <p className="mt-1 font-poppins text-sm text-zinc-400">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* TEMPORAL: las asesorías aún no se reservan con el sistema de citas; por ahora se coordinan por WhatsApp. */}
        <div className="flex min-w-0 flex-col items-start gap-3">
          <a
            href={enlaceWhatsApp(mensajeWhatsApp)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 max-w-full items-center justify-center gap-3 rounded-full bg-oro px-8 py-3 text-center font-poppins font-semibold text-black shadow-lg shadow-oro/20 duration-300 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oro active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <FaWhatsapp aria-hidden="true" size={22} className="shrink-0" />
            {textoBoton}
            <span className="sr-only"> (se abre WhatsApp en una pestaña nueva)</span>
          </a>
          <p className="font-poppins text-xs text-zinc-500">Por ahora coordinamos las asesorías por WhatsApp.</p>
        </div>
      </div>
    </section>
  )
}

export default SeccionAsesoria
