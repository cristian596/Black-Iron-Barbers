import { Link } from 'react-router-dom'
import { IoChevronDown } from 'react-icons/io5'
import HeroDatos from './HeroDatos'
import { negocio } from '../../data/negocio'

// Las animaciones solo corren con motion-safe: con prefers-reduced-motion todo queda estático.
// Los retrasos escalonan la entrada; el fundido final termina en #0f0f0f, el fondo de "Reserva a tu manera".
const Hero = () => (
  <section
    aria-labelledby='hero-titulo'
    className='relative isolate overflow-hidden bg-[#0f0f0f] text-white min-h-[max(34rem,calc(100svh-7rem))] flex items-center'
  >
    {/* Foto: pantalla completa en móvil, 62 % a la derecha desde tablet con fundido a negro */}
    <div className='absolute inset-0 -z-10 overflow-hidden md:left-auto md:w-[62%]'>
      <img
        src='/CourtMan/court_14.webp'
        alt='Retrato de perfil de un hombre con corte degradado, barba cuidada y un aro en la oreja'
        width={736}
        height={736}
        fetchPriority='high'
        decoding='async'
        className='h-full w-full object-cover object-[65%_center] motion-safe:animate-hero-zoom'
      />
      <div className='absolute inset-0 bg-linear-to-r from-black/85 via-black/50 to-black/10 md:from-[#0f0f0f] md:via-[#0f0f0f]/50 md:to-transparent' />
    </div>

    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-linear-to-t from-[#0f0f0f] to-transparent'
    />

    <div className='relative w-full max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-24 pb-28'>
      <div className='max-w-3xl'>
        <p className='font-poppins text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-oro mb-5 motion-safe:animate-hero-entrada'>
          Barbería de autor · {negocio.ciudad}
        </p>

        <h1
          id='hero-titulo'
          className='font-cinzel font-bold uppercase tracking-wide leading-[1.05] text-4xl sm:text-5xl lg:text-7xl motion-safe:animate-hero-entrada motion-safe:[animation-delay:120ms]'
        >
          <span className='block'>No es solo un corte.</span>
          <span className='block'>
            Es tu <span className='text-oro'>firma</span>.
          </span>
        </h1>

        <span
          aria-hidden='true'
          className='block h-px w-20 bg-oro my-6 motion-safe:animate-hero-entrada motion-safe:[animation-delay:240ms]'
        />

        <p className='font-poppins text-base md:text-lg text-zinc-200 max-w-xl motion-safe:animate-hero-entrada motion-safe:[animation-delay:300ms]'>
          Cortes y barba con barberos que cuidan cada detalle. Reserva en línea, sin llamadas.
        </p>

        <div className='mt-8 flex flex-col gap-3 sm:flex-row motion-safe:animate-hero-entrada motion-safe:[animation-delay:420ms]'>
          <Link
            to='/reservar-corte'
            className='inline-flex items-center justify-center rounded-full bg-oro px-8 py-3 font-poppins font-semibold text-black hover:bg-[#e2bc58] active:scale-95 duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
          >
            Reservar mi cita
          </Link>
          <Link
            to='/cortes'
            className='inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-3 font-poppins font-semibold text-white hover:border-oro hover:text-oro active:scale-95 duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oro'
          >
            Ver servicios
          </Link>
        </div>

        <HeroDatos className='mt-10 motion-safe:animate-hero-entrada motion-safe:[animation-delay:540ms]' />
      </div>
    </div>

    {/* Indicador de scroll: decorativo, solo en pantallas con altura suficiente */}
    <div
      aria-hidden='true'
      className='absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-white/60 [@media(min-height:640px)]:flex'
    >
      <span className='font-poppins text-[10px] uppercase tracking-[0.3em]'>Desliza</span>
      <IoChevronDown size={18} className='motion-safe:animate-hero-flecha' />
    </div>
  </section>
)

export default Hero
