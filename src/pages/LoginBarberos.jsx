import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginRequest } from '../services/api'
import { useAuth } from '../context/AuthContext'
import NoIndex from '../components/ui/NoIndex'

const LoginBarberos = () => {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { usuario: usuarioActivo, login } = useAuth()

  useEffect(() => {
    if (usuarioActivo) {
      navigate(usuarioActivo.rol === 'admin' ? '/admin' : '/panel', { replace: true })
    }
  }, [usuarioActivo, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!usuario || !contrasena) {
      setError('Usuario y contraseña son obligatorios')
      return
    }

    setCargando(true)
    try {
      const data = await loginRequest(usuario, contrasena)
      login(data)
      navigate(data.usuario.rol === 'admin' ? '/admin' : '/panel')
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
    <NoIndex />
    <div className='flex flex-col justify-center items-center  bg-[#000000]'>
        <img src="/Login/logo.jpg" alt="Logo de Black Iron Barbers" className='flex justify-center items-center w-80 md:w-100'/>
        <div>
            <h1 className='p-5 flex justify-center font-bold text-5xl text-white mb-10'>Agenda Barberos</h1>
            <div >
                <form onSubmit={handleSubmit} className='flex flex-col justify-center gap-3'>
                    <div className='flex flex-col justify-center gap-3'>
                        <label htmlFor="usuario" className='sr-only'>Usuario</label>
                        <input
                          id="usuario"
                          name="usuario"
                          type="text"
                          value={usuario}
                          onChange={(e) => setUsuario(e.target.value)}
                          placeholder='Escribe tu usuario'
                          className='border w-full p-3 bg-white rounded-xl placeholder-gray-700'
                        />
                    </div>

                    <div className='flex flex-col justify-center gap-3'>
                        <label htmlFor="contrasena" className='sr-only'>Contraseña</label>
                        <input
                          id="contrasena"
                          name="contrasena"
                          type="password"
                          value={contrasena}
                          onChange={(e) => setContrasena(e.target.value)}
                          placeholder='Contraseña'
                          className='border w-full p-3 bg-white rounded-xl placeholder-gray-700'
                        />
                    </div>

                    {error && (
                      <p className='text-red-400 font-medium text-center'>{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={cargando}
                      className='w-full bg-amber-50 p-2 mt-4 mb-10 font-medium text-xl rounded-xl cursor-pointer active:scale-95 duration-500 hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {cargando ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>

        </div>
    </div>
    </>
  )
}

export default LoginBarberos
