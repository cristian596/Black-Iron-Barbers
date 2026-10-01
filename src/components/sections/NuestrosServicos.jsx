import { useNavigate } from 'react-router-dom'

const NuestrosServicos = () => {
    const navigate = useNavigate()
  return (
    <>
    <div className='flex flex-col justify-center items-center p-20 gap-10 bg-cover bg-no-repeat bg-center'
    style={{
        backgroundImage:"url('/CourtMan/court_11.jpg')"
    }}>
        <div className='flex flex-col justify-center items-center'>
            <p className='text-4xl text-white lg:text-9xl'>Conoce Todos Nuestros</p>
            <p className='text-4xl text-white lg:text-9xl'>Servicios y Precios</p>
        </div>
        
        <button 
        onClick={()=> navigate("/cortes")}
        className='rounded-xl border bg-red-500 p-2 text-white hover:bg-amber-200 hover:text-black cursor-pointer active:scale-95 duration-300' >Mas Información</button>
    </div>
    </>
  )
}

export default NuestrosServicos
