import { ANTES_DESPUES, CORTES_MASCULINOS } from '../data/galeria'

const Galeria = () => {
  return (
    <>
    <div>
      {/*Cortes antes y despues */}
      <div className='bg-linear-to-br from-black to-yellow-700 p-2'>
        <h1 className='flex justify-center items-center py-2 text-5xl font-semibold font-bebas drop-shadow-lg text-white tracking-widest lg:text-7xl'>Antes y despues </h1>
        <p className="text-yellow-400 text-center lg:text-2xl font-semibold">Transformaciones reales de nuestros clientes</p>

        <div className='grid grid-cols-2 p-2 md:grid-cols-3 gap-2 lg:grid-cols-4 lg:auto-rows-[400px]'>

          {ANTES_DESPUES.map((foto) => (
            <div key={foto.src} className='overflow-hidden rounded-2xl cursor-pointer hover:scale-90 transition-transform duration-300'>
              <img className='w-full h-full object-cover' src={foto.src} alt={foto.alt} loading='lazy' />
            </div>
          ))}

      </div>
     </div>

    {/*Cortes Masculinos */}
      <div className='bg-linear-to-tr from-black via-zinc-600 to-slate-800 p-2'>
        <h2 className='flex justify-center items-center py-2 text-5xl font-semibold font-bebas drop-shadow-lg text-white tracking-widest lg:text-7xl'>
            Cortes Masculinos
        </h2>
        <p className="text-white text-center lg:text-2xl font-semibold pb-2">
            Estilo, precisión y personalidad en cada corte.
        </p>

        <div className='grid grid-cols-2 p-2 md:grid-cols-3 gap-2 lg:grid-cols-4 lg:auto-rows-[400px]'>

          {CORTES_MASCULINOS.map((foto) => (
            <div key={foto.src} className='overflow-hidden rounded-2xl cursor-pointer hover:scale-90 transition-transform duration-300'>
              <img className='w-full h-full object-cover' src={foto.src} alt={foto.alt} loading='lazy' />
            </div>
          ))}

        </div>
      </div>
    </div>
    </>
  )
}

export default Galeria
