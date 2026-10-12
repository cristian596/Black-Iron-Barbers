import { FaStar } from 'react-icons/fa'
import { TESTIMONIOS } from '../../data/testimonios'
import useVisible from '../../hooks/useVisible'

const ESCALONADO_MS = 60

const Testimonios = () => {
  // Umbral bajo: la rejilla es alta en móvil y con 0.3 podría no alcanzarse
  const [ref, visible] = useVisible(0.15)

  return (
    <section aria-labelledby='titulo-testimonios' className='bg-[#141414] px-5 py-12 md:py-16'>
      <h2
        id='titulo-testimonios'
        className='mb-8 text-center font-cinzel text-3xl font-bold text-white md:text-4xl'
      >
        Lo que dicen nuestros clientes
      </h2>
      <div ref={ref} className='mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {TESTIMONIOS.map(({ id, nombre, calificacion, comentario }, indice) => (
          <figure
            key={id}
            style={{ transitionDelay: `${indice * ESCALONADO_MS}ms` }}
            className={`m-0 flex flex-col gap-2 rounded-xl border border-gray-700 bg-[#1a1a1a] p-5 transition-opacity duration-700 motion-reduce:opacity-100 motion-reduce:transition-none ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className='flex gap-1' aria-hidden='true'>
              {Array.from({ length: 5 }, (_, i) => (
                <FaStar key={i} className={i < calificacion ? 'text-oro' : 'text-gray-600'} />
              ))}
            </div>
            <span className='sr-only'>{calificacion} de 5 estrellas</span>
            <blockquote className='font-poppins text-sm text-gray-300'>
              &ldquo;{comentario}&rdquo;
            </blockquote>
            <figcaption className='mt-auto font-poppins font-semibold text-white'>{nombre}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export default Testimonios
