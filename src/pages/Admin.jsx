import { useNavigate } from 'react-router-dom'

const Admin = () => {
  const navigate = useNavigate()
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null')

  const cerrarSesion = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/login-barberos')
  }

  return (
    <div className='flex flex-col items-center justify-center gap-4 py-20'>
      <h1 className='text-4xl font-bold'>Panel del Administrador</h1>
      <p className='text-xl'>Usuario: {usuario?.usuario}</p>
      <p className='text-xl'>Rol: {usuario?.rol}</p>
      <button
        onClick={cerrarSesion}
        className='rounded-xl border bg-red-500 p-2 text-white hover:bg-red-400 cursor-pointer active:scale-95 duration-300'
      >
        Cerrar sesión
      </button>
    </div>
  )
}

export default Admin
