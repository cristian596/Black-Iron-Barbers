import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { obtenerCitas, actualizarCita, cambiarContrasena } from '../services/api'
import TablaCitas from '../components/dashboard/TablaCitas'
import FiltrosCitas from '../components/dashboard/FiltrosCitas'
import { hoyISO } from '../utils/formato'

const Panel = () => {
  const { usuario, token, logout } = useAuth()
  const navigate = useNavigate()
  const hoy = hoyISO()

  const [citasHoy, setCitasHoy] = useState([])
  const [cargandoHoy, setCargandoHoy] = useState(true)
  const [errorHoy, setErrorHoy] = useState('')

  const [citas, setCitas] = useState([])
  const [cargandoCitas, setCargandoCitas] = useState(true)
  const [errorCitas, setErrorCitas] = useState('')

  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [fechaFiltro, setFechaFiltro] = useState('')

  const [accionCitaId, setAccionCitaId] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    const cargarCitasHoy = async () => {
      setCargandoHoy(true)
      setErrorHoy('')
      try {
        const data = await obtenerCitas(token, { fecha: hoy })
        setCitasHoy(data)
      } catch (err) {
        setErrorHoy(err.message)
      } finally {
        setCargandoHoy(false)
      }
    }
    cargarCitasHoy()
  }, [token, hoy, recarga])

  useEffect(() => {
    const cargarCitas = async () => {
      setCargandoCitas(true)
      setErrorCitas('')
      try {
        const filtros = {}
        if (estadoFiltro) filtros.estado = estadoFiltro
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
  }, [token, estadoFiltro, fechaFiltro, recarga])

  const cambiarEstadoCita = async (cita, nuevoEstado) => {
    setErrorAccion('')
    setAccionCitaId(cita.id)
    try {
      await actualizarCita(token, cita.id, { estado: nuevoEstado })
      setRecarga((valor) => valor + 1)
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setAccionCitaId(null)
    }
  }

  const handleCompletar = (cita) => cambiarEstadoCita(cita, 'completada')

  const handleCancelar = (cita) => {
    const confirmado = window.confirm(
      `¿Seguro que quieres cancelar la cita de ${cita.cliente}?`
    )
    if (confirmado) {
      cambiarEstadoCita(cita, 'cancelada')
    }
  }

  const cerrarSesion = () => {
    logout()
    navigate('/login-barberos')
  }

  const pendientes = citas.filter((c) => c.estado === 'pendiente')
  const completadas = citas.filter((c) => c.estado === 'completada')
  const canceladas = citas.filter((c) => c.estado === 'cancelada')

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">Hola, {usuario?.usuario}</h1>
            <p className="text-gray-400">Panel del barbero</p>
          </div>
          <button
            type="button"
            onClick={cerrarSesion}
            className="cursor-pointer rounded-xl border bg-red-500 p-2 px-4 text-white duration-300 hover:bg-red-400 active:scale-95"
          >
            Cerrar sesión
          </button>
        </header>

        {errorAccion && (
          <p className="rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">
            {errorAccion}
          </p>
        )}

        <section aria-labelledby="titulo-hoy">
          <h2 id="titulo-hoy" className="mb-3 text-2xl font-semibold">
            Citas de hoy
          </h2>
          {cargandoHoy ? (
            <p className="text-gray-400">Cargando citas de hoy...</p>
          ) : errorHoy ? (
            <p className="text-red-400">{errorHoy}</p>
          ) : citasHoy.length === 0 ? (
            <p className="text-gray-400">No tienes citas agendadas para hoy.</p>
          ) : (
            <TablaCitas
              citas={citasHoy}
              onCompletar={accionCitaId ? undefined : handleCompletar}
              onCancelar={accionCitaId ? undefined : handleCancelar}
            />
          )}
        </section>

        <section aria-labelledby="titulo-filtros">
          <h2 id="titulo-filtros" className="mb-3 text-2xl font-semibold">
            Mis citas
          </h2>
          <FiltrosCitas
            estado={estadoFiltro}
            fecha={fechaFiltro}
            onCambiarEstado={setEstadoFiltro}
            onCambiarFecha={setFechaFiltro}
          />

          {cargandoCitas ? (
            <p className="mt-4 text-gray-400">Cargando citas...</p>
          ) : errorCitas ? (
            <p className="mt-4 text-red-400">{errorCitas}</p>
          ) : citas.length === 0 ? (
            <p className="mt-4 text-gray-400">No hay citas que coincidan con el filtro.</p>
          ) : (
            <div className="mt-6 flex flex-col gap-8">
              <div>
                <h3 className="mb-2 text-lg font-medium text-amber-300">
                  Pendientes ({pendientes.length})
                </h3>
                {pendientes.length === 0 ? (
                  <p className="text-gray-400">No hay citas pendientes.</p>
                ) : (
                  <TablaCitas
                    citas={pendientes}
                    onCompletar={accionCitaId ? undefined : handleCompletar}
                    onCancelar={accionCitaId ? undefined : handleCancelar}
                  />
                )}
              </div>

              <div>
                <h3 className="mb-2 text-lg font-medium text-green-300">
                  Realizadas ({completadas.length})
                </h3>
                {completadas.length === 0 ? (
                  <p className="text-gray-400">Aún no hay citas completadas.</p>
                ) : (
                  <TablaCitas citas={completadas} />
                )}
              </div>

              {canceladas.length > 0 && (
                <div>
                  <h3 className="mb-2 text-lg font-medium text-red-300">
                    Canceladas ({canceladas.length})
                  </h3>
                  <TablaCitas citas={canceladas} />
                </div>
              )}
            </div>
          )}
        </section>

        <CambiarContrasena token={token} />
      </div>
    </div>
  )
}

const CambiarContrasena = ({ token }) => {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña')
      return
    }

    setCargando(true)
    try {
      await cambiarContrasena(token, actual, nueva)
      setMensaje('Contraseña actualizada correctamente')
      setActual('')
      setNueva('')
      setConfirmar('')
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-contrasena" className="max-w-md">
      <h2 id="titulo-contrasena" className="mb-3 text-2xl font-semibold">
        Cambiar contraseña
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="actual" className="text-sm font-medium text-gray-300">
            Contraseña actual
          </label>
          <input
            id="actual"
            name="actual"
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="nueva" className="text-sm font-medium text-gray-300">
            Nueva contraseña (mínimo 8 caracteres)
          </label>
          <input
            id="nueva"
            name="nueva"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            minLength={8}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirmar" className="text-sm font-medium text-gray-300">
            Confirmar nueva contraseña
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
            minLength={8}
            required
          />
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
          {cargando ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </section>
  )
}

export default Panel
