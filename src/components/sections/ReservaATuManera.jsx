import { Link, useNavigate } from 'react-router-dom'
import { ImScissors } from 'react-icons/im'
import { FaUserTie, FaWandMagicSparkles } from 'react-icons/fa6'
import Revelar from '../ui/Revelar'
import { RUTA_ASESORIA } from '../../data/negocio'

const ReservaATuManera = () => {
  const navigate = useNavigate()

  return (
    <div className='bg-[#0f0f0f] text-white py-14 px-5 overflow-x-clip'>
      <Revelar como='h2' className='text-center text-3xl md:text-5xl font-bold font-cinzel mb-10'>
        Reserva a tu manera
      </Revelar>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 max-w-4xl mx-auto'>
        <Revelar variante='izquierda' className='grid'>
          <button
            type='button'
            onClick={() => navigate('/cortes')}
            className='flex flex-col items-center gap-3 border border-gray-700 rounded-2xl p-8 hover:border-oro hover:bg-[#1a1a1a] cursor-pointer active:scale-95 duration-300'
          >
            <ImScissors size={40} className='text-oro' />
            <h3 className='text-2xl font-semibold font-cinzel'>Por servicio</h3>
            <p className='text-gray-400 font-poppins'>
              Elige el corte, la barba o el combo que quieres y agenda directo con ese servicio ya seleccionado.
            </p>
          </button>
        </Revelar>

        <Revelar variante='derecha' retraso={80} className='grid'>
          <button
            type='button'
            onClick={() => navigate('/#equipo')}
            className='flex flex-col items-center gap-3 border border-gray-700 rounded-2xl p-8 hover:border-oro hover:bg-[#1a1a1a] cursor-pointer active:scale-95 duration-300'
          >
            <FaUserTie size={40} className='text-oro' />
            <h3 className='text-2xl font-semibold font-cinzel'>Por barbero</h3>
            <p className='text-gray-400 font-poppins'>
              Elige a tu barbero de confianza desde nuestro equipo y agenda directo con él ya seleccionado.
            </p>
          </button>
        </Revelar>

        <Revelar retraso={160} className='grid min-w-0 md:col-span-2'>
          {/* Provisional: la página de asesoría aún no existe, por eso se evita la navegación */}
          <Link
            to={RUTA_ASESORIA}
            onClick={(e) => e.preventDefault()}
            className='flex w-full min-w-0 items-center justify-center gap-4 rounded-2xl border border-black/30 bg-oro px-6 py-5 text-center font-poppins text-base font-medium text-black shadow-lg shadow-oro/20 duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-oro/40 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 md:text-lg'
          >
            <FaWandMagicSparkles aria-hidden='true' size={28} className='shrink-0' />
            <span className='min-w-0'>
              Descubre tu mejor versión con una{' '}
              <strong className='font-cinzel font-extrabold'>ASESORÍA</strong> de imagen{' '}
              <strong className='font-cinzel font-extrabold'>GRATIS</strong> en BlackIron
            </span>
          </Link>
        </Revelar>
      </div>
    </div>
  )
}

export default ReservaATuManera
