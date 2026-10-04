import { Link } from 'react-router-dom'
import Revelar from '../ui/Revelar'

const NuestrosServicos = () => {
  return (
    <>
    <div className='flex flex-col justify-center items-center p-6 sm:p-12 lg:p-20 gap-10 bg-cover bg-no-repeat bg-center'
    style={{
        backgroundImage:"url('/CourtMan/court_11.jpg')"
    }}>
        <div className='flex flex-col justify-center items-center'>
            <Revelar como='p' className='text-4xl text-white lg:text-9xl'>Conoce Todos Nuestros</Revelar>
            <Revelar como='p' retraso={80} className='text-4xl text-white lg:text-9xl'>Servicios y Precios</Revelar>
        </div>

        <Revelar retraso={160}>
          <Link
          to='/cortes'
          className='inline-block rounded-xl border bg-red-500 p-2 text-white hover:bg-amber-200 hover:text-black cursor-pointer active:scale-95 duration-300' >Mas Información</Link>
        </Revelar>
    </div>
    </>
  )
}

export default NuestrosServicos
