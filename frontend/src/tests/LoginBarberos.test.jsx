import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import LoginBarberos from '../pages/LoginBarberos'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { login as loginRequest, setUnauthorizedHandler } from '../services/api'

vi.mock('../services/api', () => ({
  login: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  setContrasenaCaducadaHandler: vi.fn(),
}))

const renderLogin = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/acceso']}>
        <Routes>
          <Route path="/" element={<p>Inicio público</p>} />
          <Route path="/acceso" element={<LoginBarberos />} />
          <Route path="/admin" element={<p>Panel de administrador</p>} />
          <Route path="/panel" element={<p>Panel de barbero</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )

// Solo margen de espera: con la CPU saturada (varios archivos a la vez) el límite por defecto
// (1 s de findBy, 5 s por test) no alcanza para el login y la carga perezosa. No cambia lo que se verifica.
const ESPERA = 10_000
const ESPERA_TEST = 20_000

// Token con la forma de un JWT (solo se decodifica el payload en el front).
const tokenCon = (payload) => `x.${btoa(JSON.stringify(payload))}.y`
const enUnaHora = () => Math.floor(Date.now() / 1000) + 3600

const escribirYEnviar = async (user, usuario = 'barbero1', clave = 'clavecorrecta') => {
  await user.type(screen.getByLabelText('Usuario'), usuario)
  await user.type(screen.getByLabelText('Contraseña'), clave)
  await user.click(screen.getByRole('button', { name: /ingresar/i }))
}

describe('LoginBarberos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('muestra un mensaje de error cuando el login falla', async () => {
    loginRequest.mockRejectedValueOnce(new Error('Usuario o contraseña incorrectos'))
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'barbero1')
    await user.type(screen.getByLabelText('Contraseña'), 'claveincorrecta')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText('Usuario o contraseña incorrectos', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('redirige a /admin cuando el usuario autenticado es admin', async () => {
    loginRequest.mockResolvedValueOnce({
      token: 'token-admin',
      usuario: { id: 1, usuario: 'admin', rol: 'admin', barbero_id: null },
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'claveadmin')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText('Panel de administrador', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('redirige a /panel cuando el usuario autenticado es barbero', async () => {
    loginRequest.mockResolvedValueOnce({
      token: 'token-barbero',
      usuario: { id: 2, usuario: 'barbero1', rol: 'barbero', barbero_id: 1 },
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Usuario'), 'barbero1')
    await user.type(screen.getByLabelText('Contraseña'), 'clavebarbero')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText('Panel de barbero', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('LoginBarberos — diseño y contenido', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('muestra insignia, título, subtítulo, campos y botón; el foco inicial está en el usuario', () => {
    renderLogin()
    expect(screen.getAllByRole('img', { name: 'Logo de Black Iron Barbers' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Agenda Barberos' })).toBeInTheDocument()
    expect(screen.getByText(/ingresa con tu usuario/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario')).toHaveFocus()
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  })

  it('muestra y oculta la contraseña con el ojo', async () => {
    const user = userEvent.setup()
    renderLogin()
    const campo = screen.getByLabelText('Contraseña')
    expect(campo).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('no ofrece registro ni "recordarme", y el texto de contraseña olvidada es informativo (no un enlace)', () => {
    renderLogin()
    expect(screen.queryByText(/reg[ií]strate|crear cuenta|no tienes cuenta/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recordarme|recu[eé]rdame/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    const texto = screen.getByText('¿Olvidaste tu contraseña? Pídele al administrador que la restablezca')
    expect(texto.closest('a')).toBeNull()
    expect(screen.queryByRole('link', { name: /olvidaste/i })).not.toBeInTheDocument()
  })

  it('"Volver al sitio" es un enlace a /', async () => {
    const user = userEvent.setup()
    renderLogin()
    const enlace = screen.getByRole('link', { name: /volver al sitio/i })
    expect(enlace).toHaveAttribute('href', '/')
    await user.click(enlace)
    expect(await screen.findByText('Inicio público')).toBeInTheDocument()
  })

  it('el panel de marca lista sus puntos de valor y no hay más enlaces que "Volver al sitio"', () => {
    renderLogin()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})

describe('LoginBarberos — envío y errores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('con campos vacíos avisa sin llamar a la API', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: /ingresar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario y contraseña son obligatorios')
    expect(loginRequest).not.toHaveBeenCalled()
  })

  it('durante el envío deshabilita el botón, muestra "Ingresando..." y no permite un doble envío', async () => {
    let resolver
    loginRequest.mockReturnValueOnce(new Promise((r) => { resolver = r }))
    const user = userEvent.setup()
    renderLogin()
    await escribirYEnviar(user)

    const boton = screen.getByRole('button', { name: /ingresando/i })
    expect(boton).toBeDisabled()
    fireEvent.submit(boton.closest('form'))
    expect(loginRequest).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolver({ token: 't', usuario: { id: 2, usuario: 'barbero1', rol: 'barbero', barbero_id: 1 } })
    })
    expect(await screen.findByText('Panel de barbero')).toBeInTheDocument()
  })

  it('credenciales incorrectas (401): mensaje genérico dentro de un role="alert"', async () => {
    loginRequest.mockRejectedValueOnce(Object.assign(new Error('lo que diga el back'), { status: 401 }))
    const user = userEvent.setup()
    renderLogin()
    await escribirYEnviar(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos')
  })

  it('error de red: pide revisar la conexión', async () => {
    loginRequest.mockRejectedValueOnce(Object.assign(new Error('No se pudo conectar con el servidor'), { red: true }))
    const user = userEvent.setup()
    renderLogin()
    await escribirYEnviar(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos conectar con el servidor/i)
  })

  it('error 500: servidor no disponible', async () => {
    loginRequest.mockRejectedValueOnce(Object.assign(new Error('Error interno'), { status: 500 }))
    const user = userEvent.setup()
    renderLogin()
    await escribirYEnviar(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(/servidor no está disponible/i)
  })

  it('tras un error el botón vuelve a estar habilitado', async () => {
    loginRequest.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }))
    const user = userEvent.setup()
    renderLogin()
    await escribirYEnviar(user)
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeEnabled()
  })
})

describe('LoginBarberos — límite de intentos (429)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  const llenarYEnviar = async () => {
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'barbero1' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clavecorrecta' } })
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Usuario').closest('form'))
    })
  }

  it('muestra "Vuelve a intentarlo en N minutos", bloquea el botón con cuenta atrás y lo libera al terminar', async () => {
    loginRequest.mockRejectedValueOnce(Object.assign(new Error('Demasiados'), { status: 429, reintentar_en_seg: 125 }))
    renderLogin()
    await llenarYEnviar()

    expect(screen.getByRole('alert')).toHaveTextContent('Vuelve a intentarlo en 3 minutos')
    expect(screen.getByRole('button', { name: /espera 2:05/i })).toBeDisabled()

    // Mientras dura el bloqueo no se envía nada aunque se fuerce el submit.
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Usuario').closest('form'))
    })
    expect(loginRequest).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(65_000) })
    expect(screen.getByRole('alert')).toHaveTextContent('Vuelve a intentarlo en 1 minuto.')
    expect(screen.getByRole('button', { name: /espera 1:00/i })).toBeDisabled()

    await act(async () => { vi.advanceTimersByTime(61_000) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeEnabled()
  })

  it('si el 429 no trae el tiempo, usa 15 minutos', async () => {
    loginRequest.mockRejectedValueOnce(Object.assign(new Error('Demasiados'), { status: 429 }))
    renderLogin()
    await llenarYEnviar()
    expect(screen.getByRole('alert')).toHaveTextContent('Vuelve a intentarlo en 15 minutos')
  })
})

describe('LoginBarberos — avisos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('no muestra el aviso de sesión expirada en una visita normal', () => {
    renderLogin()
    expect(screen.queryByText(/tu sesión expiró/i)).not.toBeInTheDocument()
  })

  it('muestra "Tu sesión expiró" cuando el token guardado ya venció', () => {
    localStorage.setItem('token', tokenCon({ id: 1, rol: 'barbero', exp: Math.floor(Date.now() / 1000) - 60 }))
    renderLogin()
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró. Vuelve a iniciar sesión')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('muestra el aviso cuando la API cierra la sesión (401 con token) y no cuando el usuario sale por su cuenta', async () => {
    localStorage.setItem('token', tokenCon({ id: 2, usuario: 'barbero1', rol: 'barbero', barbero_id: 1, exp: enUnaHora() }))
    const Salir = () => {
      const { usuario, sesionExpirada } = useAuth()
      return <p>{usuario ? 'con sesión' : sesionExpirada ? 'sesión expirada' : 'sin sesión'}</p>
    }
    render(
      <AuthProvider>
        <Salir />
      </AuthProvider>
    )
    expect(screen.getByText('con sesión')).toBeInTheDocument()

    // api.js llama a este handler ante un 401 con token; el panel real redirigiría a /acceso (ProtectedRoute).
    const handler = setUnauthorizedHandler.mock.calls.map((c) => c[0]).filter(Boolean).at(-1)
    await act(async () => { handler() })
    expect(screen.getByText('sesión expirada')).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('el aviso de sesión expirada desaparece tras iniciar sesión de nuevo', async () => {
    localStorage.setItem('token', tokenCon({ id: 1, rol: 'barbero', exp: Math.floor(Date.now() / 1000) - 60 }))
    loginRequest.mockResolvedValueOnce({ token: 't', usuario: { id: 2, usuario: 'barbero1', rol: 'barbero', barbero_id: 1 } })
    const user = userEvent.setup()
    renderLogin()
    expect(screen.getByText(/tu sesión expiró/i)).toBeInTheDocument()
    await escribirYEnviar(user)
    expect(await screen.findByText('Panel de barbero')).toBeInTheDocument()
  })

  it('avisa del Bloq Mayús activo en la contraseña y lo quita al desactivarse', () => {
    renderLogin()
    const campo = screen.getByLabelText('Contraseña')
    fireEvent.keyDown(campo, { key: 'a', modifierCapsLock: true })
    expect(screen.getByRole('status')).toHaveTextContent('Bloq Mayús está activado')
    fireEvent.keyUp(campo, { key: 'a', modifierCapsLock: false })
    expect(screen.queryByText(/bloq mayús/i)).not.toBeInTheDocument()
  })
})

describe('LoginBarberos — redirecciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('un barbero con la contraseña caducada va a /panel (donde el layout muestra la pantalla obligatoria)', async () => {
    loginRequest.mockResolvedValueOnce({
      token: 't',
      usuario: { id: 2, usuario: 'barbero1', rol: 'barbero', barbero_id: 1 },
      vigencia: { estado: 'caducada', dias_restantes: 0, vence_en: '2026-01-01' },
    })
    const user = userEvent.setup()
    renderLogin()
    await escribirYEnviar(user)
    expect(await screen.findByText('Panel de barbero')).toBeInTheDocument()
  })

  it('quien ya tiene sesión y entra a /acceso va directo a su panel', async () => {
    localStorage.setItem('token', tokenCon({ id: 1, usuario: 'admin', rol: 'admin', barbero_id: null, exp: enUnaHora() }))
    renderLogin()
    expect(await screen.findByText('Panel de administrador')).toBeInTheDocument()
  })
})
