import ButtonReserva from '../ui/ButtonReserva'

const Hero = () => {
  return (
    <div
      className='relative w-full min-h-[70vh] bg-cover bg-center border-gray-600 border-b'
      style={{ backgroundImage: "url('/CourtMan/court_14.jpg')" }}
    >
      <div className='absolute inset-0 bg-black/40' />
      <div className='relative z-10 text-white p-10 flex flex-col justify-center h-full min-h-[70vh] max-w-2xl'>
        <p className='text-[#D4AF37] font-bold text-xl mb-6'>
          Barberia de Autor - Bogota
        </p>
        <h1 className='text-5xl md:text-6xl font-bold leading-tight'>
          "No es solo un corte.
          Es tu firma"
        </h1>

        <ButtonReserva />
      </div>
    </div>
  )
}

export default Hero
