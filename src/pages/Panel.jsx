import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { obtenerCitas, actualizarCita, obtenerSesion } from '../services/api'
import TablaCitas from '../components/dashboard/TablaCitas'
import FiltrosCitas from '../components/dashboard/FiltrosCitas'
import AvisoCaducidad from '../components/dashboard/AvisoCaducidad'
import CambioObligatorio from '../components/dashboard/CambioObligatorio'
import CargandoPagina from '../components/ui/CargandoPagina'
import NoIndex from '../components/ui/NoIndex'
import { hoyISO } from '../utils/fechas'

const ContenidoPanel = () => {
  const { usuario, token, logout, vigencia, actualizarVigencia } = useAuth()
  const navigate = useNavigate()
  const [contrasenaCambiada, setContrasenaCambiada] = useState(false)
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
    navigate('/acceso')
  }

  const alCambiarContrasena = (respuesta) => {
    actualizarVigencia(respuesta.vigencia)
    setContrasenaCambiada(true)
  }

  const pendientes = citas.filter((c) => c.estado === 'pendiente')
  const completadas = citas.filter((c) => c.estado === 'completada')
  const canceladas = citas.filter((c) => c.estado === 'cancelada')

  return (
    <>
    <NoIndex />
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

        {vigencia?.estado === 'por_vencer' && (
          <AvisoCaducidad vigencia={vigencia} token={token} alCambiada={alCambiarContrasena} />
        )}
        <p className="rounded-lg bg-green-900/40 p-3 text-green-300 empty:hidden" role="status">
          {contrasenaCambiada ? 'Contraseña actualizada. La nueva vale 60 días.' : ''}
        </p>

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

      </div>
    </div>
    </>
  )
}

// Decide qué ve el barbero según el estado de su contraseña: caducada → pantalla obligatoria de cambio (sin acceso
// al resto del panel); en cualquier otro caso, el panel (con un aviso si está por vencer). Tras recargar la página
// el estado no se conoce (vigencia undefined): se consulta a /auth/sesion antes de mostrar nada.
const Panel = () => {
  const { token, vigencia, actualizarVigencia, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (vigencia !== undefined) return undefined
    let activo = true
    obtenerSesion(token)
      .then((datos) => activo && actualizarVigencia(datos.vigencia))
      // Sin respuesta, se muestra el panel: el back-end sigue bloqueando todo si la contraseña está caducada
      // y ese 403 lleva igualmente a la pantalla obligatoria.
      .catch(() => activo && actualizarVigencia(null))
    return () => {
      activo = false
    }
  }, [token, vigencia, actualizarVigencia])

  if (vigencia === undefined) return <CargandoPagina />

  if (vigencia?.estado === 'caducada') {
    return (
      <CambioObligatorio
        token={token}
        alCambiada={(respuesta) => actualizarVigencia(respuesta.vigencia)}
        alCerrarSesion={() => {
          logout()
          navigate('/acceso')
        }}
      />
    )
  }

  return <ContenidoPanel />
}

export default Panel
