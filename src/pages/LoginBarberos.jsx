import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiArrowLeft, FiClock, FiLoader, FiLock, FiLogIn, FiUser } from 'react-icons/fi'
import { login as loginRequest } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useCuentaAtras } from '../hooks/useCuentaAtras'
import NoIndex from '../components/ui/NoIndex'
import Revelar from '../components/ui/Revelar'
import Campo, { ESTILO_CAMPO } from '../components/admin/CampoFormulario'
import CampoContrasena from '../components/admin/CampoContrasena'
import InsigniaLogo from '../components/login/InsigniaLogo'
import PanelMarca from '../components/login/PanelMarca'

const SEGUNDOS_LIMITE_POR_DEFECTO = 15 * 60

// Mensajes por tipo de fallo. Los de credenciales no distinguen entre usuario inexistente, inactivo o contraseña errónea.
const MENSAJES = {
  credenciales: 'Usuario o contraseña incorrectos',
  vacio: 'Usuario y contraseña son obligatorios',
  red: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  servidor: 'El servidor no está disponible por ahora. Inténtalo de nuevo en unos minutos.',
}

const mensajeDeError = (err) => {
  if (err.status === 401) return MENSAJES.credenciales
  if (err.red) return MENSAJES.red
  if (err.status >= 500) return MENSAJES.servidor
  return err.message || MENSAJES.servidor
}

const formatearTiempo = (segundos) => {
  const m = Math.floor(segundos / 60)
  const s = String(segundos % 60).padStart(2, '0')
  return `${m}:${s}`
}

const AvisoError = ({ children, icono: Icono = FiAlertCircle }) => (
  <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
    <Icono aria-hidden="true" className="mt-0.5 shrink-0" />
    <span>{children}</span>
  </p>
)

const LoginBarberos = () => {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [bloqMayus, setBloqMayus] = useState(false)
  const enviando = useRef(false)
  const usuarioRef = useRef(null)
  const { restante, iniciar, detener } = useCuentaAtras()
  const navigate = useNavigate()
  const { usuario: usuarioActivo, sesionExpirada, login } = useAuth()

  useEffect(() => {
    usuarioRef.current?.focus()
  }, [])

  useEffect(() => {
    if (usuarioActivo) {
      navigate(usuarioActivo.rol === 'admin' ? '/admin' : '/panel', { replace: true })
    }
  }, [usuarioActivo, navigate])

  // Límite de intentos (429): el aviso y el botón bloqueado duran lo que dure la cuenta atrás.
  const bloqueado = restante > 0

  const leerBloqMayus = (e) => setBloqMayus(e.getModifierState?.('CapsLock') ?? false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (enviando.current || bloqueado) return
    setError('')

    if (!usuario.trim() || !contrasena) {
      setError(MENSAJES.vacio)
      return
    }

    enviando.current = true
    setCargando(true)
    try {
      const data = await loginRequest(usuario, contrasena)
      login(data)
      navigate(data.usuario.rol === 'admin' ? '/admin' : '/panel')
    } catch (err) {
      if (err.status === 429) {
        iniciar(err.reintentar_en_seg ?? SEGUNDOS_LIMITE_POR_DEFECTO)
      } else {
        detener()
        setError(mensajeDeError(err))
      }
    } finally {
      enviando.current = false
      setCargando(false)
    }
  }

  const minutos = Math.max(1, Math.ceil(restante / 60))

  return (
    <>
      <NoIndex />
      <div className="relative min-h-dvh overflow-x-clip bg-black font-poppins text-white lg:grid lg:grid-cols-2">
        <PanelMarca />

        <main className="relative flex min-w-0 flex-col items-center justify-center gap-6 px-4 py-8 sm:px-8">
          <div aria-hidden="true" className="pointer-events-none absolute top-1/4 left-1/2 size-80 -translate-x-1/2 rounded-full bg-oro/10 blur-3xl" />

          <div className="relative w-full max-w-md">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
            >
              <FiArrowLeft aria-hidden="true" />
              Volver al sitio
            </Link>
          </div>

          <div className="relative w-full max-w-md motion-safe:animate-hero-entrada">
            <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 px-5 pt-8 pb-6 shadow-2xl sm:px-8">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-oro to-transparent" />

              <div className="flex flex-col items-center text-center">
                <InsigniaLogo className="size-20 lg:hidden" />
                <h1 className="mt-4 font-cinzel text-3xl font-bold text-white lg:mt-0 sm:text-4xl">Agenda Barberos</h1>
                <p className="mt-2 text-sm text-zinc-400">Ingresa con tu usuario para ver y gestionar tus citas.</p>
              </div>

              {sesionExpirada && (
                <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-oro/40 bg-oro/10 px-3 py-2 text-sm text-oro">
                  <FiClock aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>Tu sesión expiró. Vuelve a iniciar sesión</span>
                </p>
              )}

              <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
                <Campo
                  id="usuario"
                  etiqueta={
                    <span className="inline-flex items-center gap-2">
                      <FiUser aria-hidden="true" className="text-oro" />
                      Usuario
                    </span>
                  }
                >
                  <input
                    ref={usuarioRef}
                    id="usuario"
                    name="usuario"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="Escribe tu usuario"
                    className={`${ESTILO_CAMPO} border-white/15`}
                  />
                </Campo>

                <div onKeyDown={leerBloqMayus} onKeyUp={leerBloqMayus} onBlur={() => setBloqMayus(false)} className="flex min-w-0 flex-col gap-1">
                  <CampoContrasena
                    id="contrasena"
                    etiqueta={
                      <span className="inline-flex items-center gap-2">
                        <FiLock aria-hidden="true" className="text-oro" />
                        Contraseña
                      </span>
                    }
                    valor={contrasena}
                    alCambiar={(e) => setContrasena(e.target.value)}
                    autoComplete="current-password"
                  />
                  {bloqMayus && (
                    <p role="status" className="flex items-center gap-2 text-sm text-oro">
                      <FiAlertCircle aria-hidden="true" />
                      Bloq Mayús está activado
                    </p>
                  )}
                </div>

                {error && <AvisoError>{error}</AvisoError>}
                {bloqueado && (
                  <AvisoError icono={FiClock}>
                    Demasiados intentos. Vuelve a intentarlo en {minutos} {minutos === 1 ? 'minuto' : 'minutos'}.
                  </AvisoError>
                )}

                <button
                  type="submit"
                  disabled={cargando || bloqueado}
                  className="mt-2 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#b8942a] via-oro to-[#f0d878] px-4 font-semibold text-black transition active:scale-[0.98] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cargando ? (
                    <>
                      <FiLoader aria-hidden="true" className="motion-safe:animate-spin" />
                      Ingresando...
                    </>
                  ) : bloqueado ? (
                    <>
                      <FiClock aria-hidden="true" />
                      Espera {formatearTiempo(restante)}
                    </>
                  ) : (
                    <>
                      <FiLogIn aria-hidden="true" />
                      Ingresar
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>

          <Revelar className="relative w-full max-w-md text-center text-sm text-zinc-400">
            <p>¿Olvidaste tu contraseña? Pídele al administrador que la restablezca</p>
          </Revelar>
        </main>
      </div>
    </>
  )
}

export default LoginBarberos
