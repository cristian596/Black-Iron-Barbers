import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import {
  obtenerCitas,
  actualizarCita,
  obtenerBarberos,
  obtenerResumenAdmin,
  obtenerUsuarios,
  crearUsuarioBarbero,
  actualizarUsuarioBarbero,
} from '../services/api'
import TablaCitas from '../components/dashboard/TablaCitas'
import FiltrosCitas from '../components/dashboard/FiltrosCitas'
import CambiarContrasena from '../components/dashboard/CambiarContrasena'

const PESTANAS = [
  { id: 'citas', label: 'Citas' },
  { id: 'barberos', label: 'Barberos' },
]

const Admin = () => {
  const { usuario, token, logout } = useAuth()
  const navigate = useNavigate()

  const [pestana, setPestana] = useState('citas')

  const [barberosActivos, setBarberosActivos] = useState([])
  const [errorBarberos, setErrorBarberos] = useState('')

  useEffect(() => {
    const cargarBarberos = async () => {
      try {
        const data = await obtenerBarberos()
        setBarberosActivos(data)
      } catch (err) {
        setErrorBarberos(err.message)
      }
    }
    cargarBarberos()
  }, [])

  const cerrarSesion = () => {
    logout()
    navigate('/login-barberos')
  }

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">Hola, {usuario?.usuario}</h1>
            <p className="text-gray-400">Panel del administrador</p>
          </div>
          <button
            type="button"
            onClick={cerrarSesion}
            className="cursor-pointer rounded-xl border bg-red-500 p-2 px-4 text-white duration-300 hover:bg-red-400 active:scale-95"
          >
            Cerrar sesión
          </button>
        </header>

        <nav aria-label="Secciones del panel" className="flex gap-2 border-b border-white/10">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              aria-current={pestana === p.id ? 'page' : undefined}
              className={`cursor-pointer border-b-2 px-4 py-2 text-sm font-medium duration-200 ${
                pestana === p.id
                  ? 'border-amber-300 text-amber-300'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>

        {errorBarberos && <p className="text-red-400">{errorBarberos}</p>}

        {pestana === 'citas' ? (
          <SeccionCitas token={token} barberosActivos={barberosActivos} />
        ) : (
          <SeccionBarberos token={token} barberosActivos={barberosActivos} />
        )}

        <CambiarContrasena token={token} />
      </div>
    </div>
  )
}

const SeccionCitas = ({ token, barberosActivos }) => {
  const [resumen, setResumen] = useState(null)
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [errorResumen, setErrorResumen] = useState('')

  const [citas, setCitas] = useState([])
  const [cargandoCitas, setCargandoCitas] = useState(true)
  const [errorCitas, setErrorCitas] = useState('')

  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [barberoFiltro, setBarberoFiltro] = useState('')
  const [fechaFiltro, setFechaFiltro] = useState('')

  const [accionCitaId, setAccionCitaId] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    const cargarResumen = async () => {
      setCargandoResumen(true)
      setErrorResumen('')
      try {
        const data = await obtenerResumenAdmin(token)
        setResumen(data)
      } catch (err) {
        setErrorResumen(err.message)
      } finally {
        setCargandoResumen(false)
      }
    }
    cargarResumen()
  }, [token, recarga])

  useEffect(() => {
    const cargarCitas = async () => {
      setCargandoCitas(true)
      setErrorCitas('')
      try {
        const filtros = {}
        if (estadoFiltro) filtros.estado = estadoFiltro
        if (barberoFiltro) filtros.barbero = barberoFiltro
        if (fechaFiltro) filtros.fecha = fechaFiltro
        const data = await obtenerCitas(token, filtros)
        setCitas(data)
      } catch (err) {
        setErrorCitas(err.message)
      } finally {
        setCargandoCitas(false)
      }
    }
    cargarCitas()
  }, [token, estadoFiltro, barberoFiltro, fechaFiltro, recarga])

  const cambiarCita = async (cita, cambios, mensajeError) => {
    setErrorAccion('')
    setAccionCitaId(cita.id)
    try {
      await actualizarCita(token, cita.id, cambios)
      setRecarga((valor) => valor + 1)
    } catch (err) {
      setErrorAccion(mensajeError ? `${mensajeError}: ${err.message}` : err.message)
    } finally {
      setAccionCitaId(null)
    }
  }

  const handleCompletar = (cita) => cambiarCita(cita, { estado: 'completada' })

  const handleCancelar = (cita) => {
    const confirmado = window.confirm(
      `¿Seguro que quieres cancelar la cita de ${cita.cliente}?`
    )
    if (confirmado) {
      cambiarCita(cita, { estado: 'cancelada' })
    }
  }

  const handleReasignar = (cita, nuevoBarberoId) => {
    if (String(nuevoBarberoId) === String(cita.barbero_id)) return
    cambiarCita(
      cita,
      { barbero_id: Number(nuevoBarberoId) },
      'No se pudo reasignar la cita'
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen" className="mb-3 text-2xl font-semibold">
          Resumen
        </h2>
        {cargandoResumen ? (
          <p className="text-gray-400">Cargando resumen...</p>
        ) : errorResumen ? (
          <p className="text-red-400">{errorResumen}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4">
              <h3 className="mb-2 text-sm font-medium text-gray-400">Citas por estado</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {resumen.porEstado.length === 0 ? (
                  <li className="text-gray-400">Sin citas registradas.</li>
                ) : (
                  resumen.porEstado.map((fila) => (
                    <li key={fila.estado} className="flex justify-between">
                      <span className="capitalize">{fila.estado}</span>
                      <span className="font-semibold">{fila.total}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4">
              <h3 className="mb-2 text-sm font-medium text-gray-400">Citas por barbero</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {resumen.porBarbero.length === 0 ? (
                  <li className="text-gray-400">Sin barberos registrados.</li>
                ) : (
                  resumen.porBarbero.map((fila) => (
                    <li key={fila.barbero_id} className="flex justify-between">
                      <span>{fila.barbero_nombre}</span>
                      <span className="font-semibold">{fila.total}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-citas">
        <h2 id="titulo-citas" className="mb-3 text-2xl font-semibold">
          Todas las citas
        </h2>

        {errorAccion && (
          <p className="mb-3 rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">
            {errorAccion}
          </p>
        )}

        <FiltrosCitas
          estado={estadoFiltro}
          fecha={fechaFiltro}
          onCambiarEstado={setEstadoFiltro}
          onCambiarFecha={setFechaFiltro}
          barberos={barberosActivos}
          barbero={barberoFiltro}
          onCambiarBarbero={setBarberoFiltro}
        />

        {cargandoCitas ? (
          <p className="mt-4 text-gray-400">Cargando citas...</p>
        ) : errorCitas ? (
          <p className="mt-4 text-red-400">{errorCitas}</p>
        ) : citas.length === 0 ? (
          <p className="mt-4 text-gray-400">No hay citas que coincidan con el filtro.</p>
        ) : (
          <div className="mt-4">
            <TablaCitas
              citas={citas}
              mostrarBarbero
              onCompletar={accionCitaId ? undefined : handleCompletar}
              onCancelar={accionCitaId ? undefined : handleCancelar}
              onReasignar={accionCitaId ? undefined : handleReasignar}
              barberosActivos={barberosActivos}
            />
          </div>
        )}
      </section>
    </div>
  )
}

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

export default Admin
