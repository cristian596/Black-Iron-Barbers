import { useEffect, useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useBarberosActivos } from '../../hooks/useBarberosActivos'
import {
  obtenerUsuarios,
  crearUsuarioBarbero,
  actualizarUsuarioBarbero,
} from '../../services/api'

// Contenido provisional: es la pestaña "Barberos" del panel anterior, movida sin cambios de comportamiento.
// La parte 3 la reemplaza por el listado de empleados (estado, cortes del mes, crear y desactivar).
const SeccionBarberos = ({ token, barberosActivos }) => {
  const [usuarios, setUsuarios] = useState([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true)
  const [errorUsuarios, setErrorUsuarios] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    const cargarUsuarios = async () => {
      setCargandoUsuarios(true)
      setErrorUsuarios('')
      try {
        const data = await obtenerUsuarios(token)
        setUsuarios(data)
      } catch (err) {
        setErrorUsuarios(err.message)
      } finally {
        setCargandoUsuarios(false)
      }
    }
    cargarUsuarios()
  }, [token, recarga])

  const recargar = () => setRecarga((valor) => valor + 1)

  return (
    <div className="flex flex-col gap-10">
      <FormularioCrearUsuario
        token={token}
        barberosActivos={barberosActivos}
        onCreado={recargar}
      />

      <section aria-labelledby="titulo-usuarios">
        <h2 id="titulo-usuarios" className="mb-3 text-2xl font-semibold">
          Usuarios de barberos
        </h2>
        {cargandoUsuarios ? (
          <p className="text-gray-400">Cargando usuarios...</p>
        ) : errorUsuarios ? (
          <p className="text-red-400">{errorUsuarios}</p>
        ) : usuarios.length === 0 ? (
          <p className="text-gray-400">Todavía no hay usuarios de barberos creados.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {usuarios.map((u) => (
              <FilaUsuario key={u.id} usuario={u} token={token} onCambio={recargar} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const FormularioCrearUsuario = ({ token, barberosActivos, onCreado }) => {
  const [barberoId, setBarberoId] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (!barberoId) {
      setError('Selecciona un barbero')
      return
    }
    if (!nombreUsuario.trim()) {
      setError('El usuario es obligatorio')
      return
    }
    if (contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setCargando(true)
    try {
      await crearUsuarioBarbero(token, {
        usuario: nombreUsuario.trim(),
        contrasena,
        barbero_id: Number(barberoId),
      })
      setMensaje('Usuario creado correctamente')
      setBarberoId('')
      setNombreUsuario('')
      setContrasena('')
      setMostrarContrasena(false)
      onCreado()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-crear-usuario" className="max-w-md">
      <h2 id="titulo-crear-usuario" className="mb-3 text-2xl font-semibold">
        Crear usuario de barbero
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="crear-barbero" className="text-sm font-medium text-gray-300">
            Barbero
          </label>
          <select
            id="crear-barbero"
            value={barberoId}
            onChange={(e) => setBarberoId(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            required
          >
            <option value="">Selecciona un barbero</option>
            {barberosActivos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="crear-usuario" className="text-sm font-medium text-gray-300">
            Usuario
          </label>
          <input
            id="crear-usuario"
            name="crear-usuario"
            type="text"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="crear-contrasena" className="text-sm font-medium text-gray-300">
            Contraseña (mínimo 8 caracteres)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="crear-contrasena"
              name="crear-contrasena"
              type={mostrarContrasena ? 'text' : 'password'}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setMostrarContrasena((v) => !v)}
              aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="cursor-pointer rounded-lg border border-white/20 p-2 text-gray-300 hover:bg-white/10"
            >
              {mostrarContrasena ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400" role="alert">
            {error}
          </p>
        )}
        {mensaje && <p className="text-green-400">{mensaje}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="mt-2 w-fit cursor-pointer rounded-xl bg-amber-50 p-2 px-4 font-medium text-black duration-500 hover:bg-amber-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear usuario'}
        </button>
      </form>
    </section>
  )
}

const FilaUsuario = ({ usuario, token, onCambio }) => {
  const [mostrarReset, setMostrarReset] = useState(false)
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const handleResetear = async (e) => {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (nuevaContrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setCargando(true)
    try {
      await actualizarUsuarioBarbero(token, usuario.id, { contrasena: nuevaContrasena })
      setMensaje('Contraseña reseteada correctamente')
      setNuevaContrasena('')
      setMostrarContrasena(false)
      setMostrarReset(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const handleActivarDesactivar = async () => {
    const accion = usuario.activo ? 'desactivar' : 'activar'
    const confirmado = window.confirm(
      `¿Seguro que quieres ${accion} el usuario de ${usuario.barbero_nombre}?`
    )
    if (!confirmado) return

    setError('')
    setMensaje('')
    setCargando(true)
    try {
      await actualizarUsuarioBarbero(token, usuario.id, { activo: !usuario.activo })
      onCambio()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold">{usuario.barbero_nombre}</p>
          <p className="text-sm text-gray-400">Usuario: {usuario.usuario}</p>
          <span
            className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${
              usuario.activo
                ? 'border border-green-500 bg-green-100 text-green-900'
                : 'border border-red-500 bg-red-100 text-red-900'
            }`}
          >
            {usuario.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMostrarReset((v) => !v)}
            className="cursor-pointer rounded-lg border border-white/20 px-3 py-1.5 text-sm text-gray-200 duration-200 hover:bg-white/10 active:scale-95"
          >
            Resetear contraseña
          </button>
          <button
            type="button"
            onClick={handleActivarDesactivar}
            disabled={cargando}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-white duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
              usuario.activo ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {usuario.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {mostrarReset && (
        <form onSubmit={handleResetear} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`reset-contrasena-${usuario.id}`}
              className="text-sm font-medium text-gray-300"
            >
              Nueva contraseña de {usuario.barbero_nombre}
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`reset-contrasena-${usuario.id}`}
                type={mostrarContrasena ? 'text' : 'password'}
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                className="rounded-lg border border-white/20 bg-black p-2 text-white"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((v) => !v)}
                aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="cursor-pointer rounded-lg border border-white/20 p-2 text-gray-300 hover:bg-white/10"
              >
                {mostrarContrasena ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={cargando}
            className="cursor-pointer rounded-xl bg-amber-50 p-2 px-4 font-medium text-black duration-500 hover:bg-amber-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-2 text-red-400" role="alert">
          {error}
        </p>
      )}
      {mensaje && <p className="mt-2 text-green-400">{mensaje}</p>}
    </div>
  )
}

const Empleados = () => {
  const { token } = useAuth()
  const { barberosActivos, errorBarberos } = useBarberosActivos()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-playfair text-3xl font-semibold">Empleados</h1>
      {errorBarberos && <p className="text-red-400">{errorBarberos}</p>}
      <SeccionBarberos token={token} barberosActivos={barberosActivos} />
    </div>
  )
}

export default Empleados
