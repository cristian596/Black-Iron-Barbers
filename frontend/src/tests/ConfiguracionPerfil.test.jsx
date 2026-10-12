import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import { ProveedorPerfil } from '../context/PerfilContext'
import AvatarBarbero from '../components/ui/AvatarBarbero'
import NuestrosColaboradores from '../components/sections/NuestrosColaboradores'
import PasoBarbero from '../components/sections/reserva/PasoBarbero'
import * as api from '../services/api'
import { marcarBienvenidaMostrada } from '../utils/bienvenida'
import { barberoConPerfil, mensajeErrorPerfil, resolverUrlFoto, validarFoto, validarNombrePerfil } from '../utils/perfil'

vi.mock('../services/api')

// Las páginas se cargan con React.lazy: margen de espera para la suite completa.
const ESPERA = 10_000
const ESPERA_TEST = 20_000

const UUID = '3f2b8c1e-5a4d-4c3b-9e7f-1a2b3c4d5e6f'
const VIGENTE = { estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' }
const CADUCADA = { estado: 'caducada', dias_restantes: 0, vence_en: '2026-10-01' }

const sesion = (rol = 'barbero') => {
  const payload = { id: 1, usuario: rol === 'barbero' ? 'leo_acceso' : 'admin_acceso', rol, barbero_id: rol === 'barbero' ? 2 : null, exp: Math.floor(Date.now() / 1000) + 3600 }
  localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
}

const fijarEscritorio = () => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}

const perfilBarbero = (extra = {}) => ({
  usuario: 'leo_acceso', rol: 'barbero', nombre: 'Leo', foto_url: null, foto_propia: false,
  nombre_perfil: null, usa_nombre_publico: true, usa_foto_publica: true, ...extra,
})
const perfilConFoto = (extra = {}) =>
  perfilBarbero({ foto_url: `/api/perfil/foto/${UUID}.png`, foto_propia: true, usa_foto_publica: false, ...extra })
const perfilAdmin = (extra = {}) => ({
  usuario: 'admin_acceso', rol: 'admin', nombre: 'admin_acceso', foto_url: null, foto_propia: false,
  nombre_perfil: null, usa_nombre_publico: true, usa_foto_publica: true, ...extra,
})

const RESUMEN = {
  fecha: '2026-10-04', citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null,
  ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 0,
}

const montar = (ruta) => {
  const router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
  return router
}

const titulo = () => screen.findByRole('heading', { level: 1, name: 'Configuración' }, { timeout: ESPERA })
const lateral = () => screen.getByRole('complementary', { name: 'Menú de navegación' })
const archivo = (nombre = 'foto.png', tipo = 'image/png', bytes = 1000) => new File([new Uint8Array(bytes)], nombre, { type: tipo })
const errorApi = (codigo, extra = {}) => Object.assign(new Error('Error del servidor'), { codigo, status: 400, ...extra })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  marcarBienvenidaMostrada()
  sesion('barbero')
  fijarEscritorio()
  URL.createObjectURL = vi.fn(() => 'blob:vista-previa')
  URL.revokeObjectURL = vi.fn()
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 2, nombre: 'Leo', cargo: 'Barbero Senior', especialidad: 'Fade', foto: null }])
  vi.mocked(api.obtenerSesion).mockResolvedValue({ usuario: {}, vigencia: VIGENTE })
  vi.mocked(api.obtenerResumenBarbero).mockResolvedValue({ ...RESUMEN })
  vi.mocked(api.obtenerCitasPorConfirmar).mockResolvedValue({ total: 0, tope: 100, items: [] })
  vi.mocked(api.obtenerAgendaHoy).mockResolvedValue({ fecha: RESUMEN.fecha, citas: [] })
  vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilBarbero())
})

afterEach(() => {
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('utils/perfil', () => {
  it('resolverUrlFoto: la foto propia usa el ORIGEN de la API (sin duplicar /api); la pública se deja tal cual', () => {
    const propia = { foto_url: `/api/perfil/foto/${UUID}.png`, foto_propia: true }
    expect(resolverUrlFoto(propia, 'http://localhost:5001/api')).toBe(`http://localhost:5001/api/perfil/foto/${UUID}.png`)
    expect(resolverUrlFoto(propia, 'https://api.blackiron.co/api')).toBe(`https://api.blackiron.co/api/perfil/foto/${UUID}.png`)
    expect(resolverUrlFoto(propia, '/api')).toBe(`${window.location.origin}/api/perfil/foto/${UUID}.png`)
    expect(resolverUrlFoto(propia, '')).toBe(`${window.location.origin}/api/perfil/foto/${UUID}.png`)
    expect(resolverUrlFoto(propia, 'http://localhost:5001/api')).not.toContain('/api/api')
    expect(resolverUrlFoto({ foto_url: '/Barberos/leo.jpg', foto_propia: false }, 'http://localhost:5001/api')).toBe('/Barberos/leo.jpg')
    expect(resolverUrlFoto({ foto_url: null, foto_propia: false })).toBeNull()
    expect(resolverUrlFoto(null)).toBeNull()
  })

  it('resolverUrlFoto: una ruta "propia" con otra forma se rechaza (nunca apunta a otro sitio)', () => {
    expect(resolverUrlFoto({ foto_url: '//evil.com/x.png', foto_propia: true }, 'http://localhost:5001/api')).toBeNull()
    expect(resolverUrlFoto({ foto_url: '/api/perfil/foto/../../x', foto_propia: true }, 'http://localhost:5001/api')).toBeNull()
  })

  it('barberoConPerfil: cambia nombre y foto, conserva cargo y especialidad; sin perfil devuelve el público', () => {
    const publico = { id: 2, nombre: 'Leo', cargo: 'Barbero Senior', especialidad: 'Fade', foto: '/Barberos/leo.jpg' }
    expect(barberoConPerfil(publico, null)).toBe(publico)
    expect(barberoConPerfil(publico, perfilConFoto({ nombre: 'Leo B' }))).toMatchObject({
      id: 2, nombre: 'Leo B', cargo: 'Barbero Senior', especialidad: 'Fade',
    })
    expect(publico.nombre).toBe('Leo')
  })

  it.each([
    ['  Juan    Pérez  ', { valor: 'Juan Pérez' }],
    ['Al', { valor: 'Al' }],
    ['💈'.repeat(40), { valor: '💈'.repeat(40) }],
    ['a', { mensaje: 'El nombre debe tener entre 2 y 40 caracteres' }],
    ['a'.repeat(41), { mensaje: 'El nombre debe tener entre 2 y 40 caracteres' }],
    ['Ab​cd', { mensaje: 'El nombre no puede tener caracteres de control ni invisibles' }],
    ['Ab\u0000cd', { mensaje: 'El nombre no puede tener caracteres de control ni invisibles' }],
  ])('validarNombrePerfil(%j)', (entrada, esperado) => {
    expect(validarNombrePerfil(entrada)).toEqual(esperado)
  })

  it('validarFoto: tipo y tamaño con los mismos mensajes que el back-end', () => {
    expect(validarFoto(archivo('a.png', 'image/png'))).toBe('')
    expect(validarFoto(archivo('a.jpg', 'image/jpeg'))).toBe('')
    expect(validarFoto(archivo('a.webp', 'image/webp'))).toBe('')
    expect(validarFoto(archivo('a.gif', 'image/gif'))).toBe('Solo se admiten imágenes JPEG, PNG o WebP')
    expect(validarFoto(archivo('a.svg', 'image/svg+xml'))).toBe('Solo se admiten imágenes JPEG, PNG o WebP')
    expect(validarFoto(archivo('a.png', 'image/png', 2 * 1024 * 1024))).toBe('')
    expect(validarFoto(archivo('a.png', 'image/png', 2 * 1024 * 1024 + 1))).toBe('La foto no puede superar 2 MB')
  })

  it('mensajeErrorPerfil mapea los códigos del back-end', () => {
    expect(mensajeErrorPerfil(errorApi('ARCHIVO_DEMASIADO_GRANDE'))).toBe('La foto no puede superar 2 MB')
    expect(mensajeErrorPerfil(errorApi('FORMATO_NO_PERMITIDO'))).toBe('Solo se admiten imágenes JPEG, PNG o WebP')
    expect(mensajeErrorPerfil(errorApi('ARCHIVO_VACIO'))).toMatch(/vacío/)
    expect(mensajeErrorPerfil(errorApi('DEMASIADOS_INTENTOS', { reintentar_en_seg: 600 }))).toMatch(/10 minutos/)
    expect(mensajeErrorPerfil(errorApi('DEMASIADOS_INTENTOS', { reintentar_en_seg: 30 }))).toMatch(/1 minuto$/)
    expect(mensajeErrorPerfil(errorApi('DEMASIADOS_INTENTOS'))).toMatch(/unos minutos/)
    expect(mensajeErrorPerfil(errorApi('DATOS_INVALIDOS', { campo: 'nombre_perfil' }))).toBe('Error del servidor')
    expect(mensajeErrorPerfil(Object.assign(new Error('No se pudo conectar con el servidor'), { red: true }))).toBe('No se pudo conectar con el servidor')
  })
})

describe('api.js: perfil', () => {
  it('existen las cuatro funciones del perfil', async () => {
    const real = await vi.importActual('../services/api')
    for (const nombre of ['obtenerPerfil', 'actualizarPerfil', 'subirFotoPerfil', 'quitarFotoPerfil']) expect(real[nombre]).toBeTypeOf('function')
  })

  it('la foto se envía como cuerpo crudo con el Content-Type del archivo; el nombre como JSON', async () => {
    const real = await vi.importActual('../services/api')
    const fetchSimulado = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchSimulado)
    const foto = archivo('f.webp', 'image/webp')
    await real.subirFotoPerfil('tok', foto)
    await real.actualizarPerfil('tok', null)
    await real.quitarFotoPerfil('tok')
    await real.obtenerPerfil('tok')
    vi.unstubAllGlobals()

    const [subida, nombre, quitar, leer] = fetchSimulado.mock.calls
    expect(subida[0]).toMatch(/\/perfil\/foto$/)
    expect(subida[1]).toMatchObject({ method: 'POST', body: foto })
    expect(subida[1].headers).toMatchObject({ 'Content-Type': 'image/webp', Authorization: 'Bearer tok' })
    expect(nombre[1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ nombre_perfil: null }) })
    expect(quitar[1]).toMatchObject({ method: 'DELETE' })
    expect(leer[1].headers.Authorization).toBe('Bearer tok')
  })
})

describe('AvatarBarbero con URL absoluta', () => {
  it('muestra la foto de una URL absoluta y, si falla, vuelve a las iniciales', () => {
    const url = `http://localhost:5001/api/perfil/foto/${UUID}.png`
    render(<AvatarBarbero barbero={{ nombre: 'Leo B', foto: url }} />)
    expect(screen.getByAltText(/foto de leo b/i)).toHaveAttribute('src', url)
    fireEvent.error(screen.getByAltText(/foto de leo b/i))
    expect(screen.getByRole('img', { name: 'Avatar de Leo B' })).toHaveTextContent('LB')
  })

  it('al llegar una URL nueva tras un fallo, vuelve a intentarlo', () => {
    const { rerender } = render(<AvatarBarbero barbero={{ nombre: 'Leo', foto: 'http://x.test/a.png' }} />)
    fireEvent.error(screen.getByAltText(/foto de leo/i))
    rerender(<AvatarBarbero barbero={{ nombre: 'Leo', foto: 'http://x.test/b.png' }} />)
    expect(screen.getByAltText(/foto de leo/i)).toHaveAttribute('src', 'http://x.test/b.png')
  })
})

describe('/panel/configuracion (barbero)', () => {
  it('muestra el texto aclaratorio, el nombre público y el usuario de acceso como solo lectura', async () => {
    montar('/panel/configuracion')
    await titulo()
    expect(screen.getByText('Esta foto y este nombre solo se ven en tu panel. No cambian lo que ven los clientes en la web.')).toBeInTheDocument()
    expect(screen.getByText('Nombre público').nextElementSibling).toHaveTextContent('Leo')
    expect(screen.getByText('Usuario de acceso').nextElementSibling).toHaveTextContent('leo_acceso')
    // el usuario de acceso no es un campo editable
    expect(screen.queryByLabelText(/usuario de acceso/i)).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Nombre de perfil' })).toHaveAttribute('placeholder', 'Leo')
  }, ESPERA_TEST)

  it('con el perfil sin cambios, "Guardar" está deshabilitado; con un nombre válido se habilita', async () => {
    montar('/panel/configuracion')
    await titulo()
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    expect(guardar).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de perfil' }), 'Leo Barber')
    expect(guardar).toBeEnabled()
    expect(screen.getByText('10/40')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('valida en vivo: 1 carácter y más de 40 deshabilitan el botón y muestran el error; el contador avisa', async () => {
    montar('/panel/configuracion')
    await titulo()
    const campo = screen.getByRole('textbox', { name: 'Nombre de perfil' })
    const guardar = screen.getByRole('button', { name: 'Guardar' })

    await userEvent.type(campo, 'a')
    expect(guardar).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('El nombre debe tener entre 2 y 40 caracteres')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo.getAttribute('aria-describedby')).toContain('nombre-perfil-error')

    await userEvent.clear(campo)
    await userEvent.type(campo, 'b'.repeat(41))
    expect(guardar).toBeDisabled()
    expect(screen.getByText('41/40')).toHaveClass('text-red-400')
    expect(api.actualizarPerfil).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it('guarda el nombre normalizado y el sidebar, el menú de usuario y Mi cuenta se actualizan al instante', async () => {
    vi.mocked(api.actualizarPerfil).mockResolvedValue(perfilBarbero({ nombre: 'Leo Barber', nombre_perfil: 'Leo Barber', usa_nombre_publico: false }))
    montar('/panel/configuracion')
    await titulo()
    expect(within(lateral()).getByText('Leo')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de perfil' }), '  Leo   Barber ')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(api.actualizarPerfil).toHaveBeenCalledWith(expect.any(String), 'Leo Barber')
    expect(await screen.findByText('Nombre actualizado')).toBeInTheDocument()
    expect(within(lateral()).getByText('Leo Barber')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menú de usuario de Leo Barber' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled() // ya no hay cambios
    // el nombre público de solo lectura sigue siendo el de la web
    expect(screen.getByText('Nombre público').nextElementSibling).toHaveTextContent('Leo')
    // Mi cuenta (otra ruta del mismo layout) también lo muestra
    await userEvent.click(within(lateral()).getByRole('link', { name: 'Mi cuenta' }))
    expect(await within(screen.getByRole('main')).findByText('Leo Barber', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('"Usar mi nombre público" manda null y vuelve al nombre de la web', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilBarbero({ nombre: 'Pepe', nombre_perfil: 'Pepe', usa_nombre_publico: false }))
    vi.mocked(api.actualizarPerfil).mockResolvedValue(perfilBarbero())
    montar('/panel/configuracion')
    await titulo()
    expect(within(lateral()).getByText('Pepe')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nombre de perfil' })).toHaveValue('Pepe')

    await userEvent.click(screen.getByRole('button', { name: 'Usar mi nombre público' }))
    expect(api.actualizarPerfil).toHaveBeenCalledWith(expect.any(String), null)
    expect(await screen.findByText('Ahora se muestra tu nombre público')).toBeInTheDocument()
    expect(within(lateral()).getByText('Leo')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nombre de perfil' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Usar mi nombre público' })).toBeNull()
  }, ESPERA_TEST)

  it('un error del back-end al guardar el nombre se muestra junto al campo', async () => {
    vi.mocked(api.actualizarPerfil).mockRejectedValue(errorApi('DATOS_INVALIDOS', { campo: 'nombre_perfil' }))
    montar('/panel/configuracion')
    await titulo()
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de perfil' }), 'Nombre Valido')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled() // se puede reintentar
  }, ESPERA_TEST)

  it('sube una foto: vista previa antes de guardar, y al guardar el sidebar y el menú muestran la URL absoluta de la API', async () => {
    vi.mocked(api.subirFotoPerfil).mockResolvedValue(perfilConFoto())
    montar('/panel/configuracion')
    await titulo()
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).toBeNull()

    const foto = archivo('mi-foto.png')
    await userEvent.upload(screen.getByLabelText('Archivo de foto de perfil'), foto)
    expect(screen.getByAltText('Vista previa de tu nueva foto')).toHaveAttribute('src', 'blob:vista-previa')
    expect(screen.getByText(/Aún no se ha guardado/)).toBeInTheDocument()
    expect(api.subirFotoPerfil).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar foto' }))
    expect(api.subirFotoPerfil).toHaveBeenCalledWith(expect.any(String), foto)
    expect(await screen.findByText('Foto actualizada')).toBeInTheDocument()
    expect(screen.queryByAltText('Vista previa de tu nueva foto')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista-previa')

    const esperada = resolverUrlFoto(perfilConFoto())
    expect(esperada).toMatch(new RegExp(`/api/perfil/foto/${UUID}\\.png$`))
    expect(esperada).not.toContain('/api/api')
    expect(within(lateral()).getByAltText(/foto de leo/i)).toHaveAttribute('src', esperada)
    expect(within(screen.getByRole('button', { name: /Menú de usuario/ })).getByAltText('Foto de Leo')).toHaveAttribute('src', esperada)
    expect(screen.getByRole('button', { name: 'Quitar foto' })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('Cancelar descarta la vista previa sin subir nada', async () => {
    montar('/panel/configuracion')
    await titulo()
    await userEvent.upload(screen.getByLabelText('Archivo de foto de perfil'), archivo())
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByAltText('Vista previa de tu nueva foto')).toBeNull()
    expect(api.subirFotoPerfil).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('en el cliente rechaza un tipo no permitido y un archivo de más de 2 MB, sin llamar al back-end', async () => {
    montar('/panel/configuracion')
    await titulo()
    const usuario = userEvent.setup({ applyAccept: false })
    const entrada = screen.getByLabelText('Archivo de foto de perfil')

    await usuario.upload(entrada, archivo('x.gif', 'image/gif'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se admiten imágenes JPEG, PNG o WebP')
    expect(screen.queryByAltText('Vista previa de tu nueva foto')).toBeNull()

    await usuario.upload(entrada, archivo('grande.png', 'image/png', 2 * 1024 * 1024 + 1))
    expect(await screen.findByRole('alert')).toHaveTextContent('La foto no puede superar 2 MB')

    await usuario.upload(entrada, archivo('ok.png'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.subirFotoPerfil).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it.each([
    ['ARCHIVO_DEMASIADO_GRANDE', {}, 'La foto no puede superar 2 MB'],
    ['FORMATO_NO_PERMITIDO', {}, 'Solo se admiten imágenes JPEG, PNG o WebP'],
    ['DEMASIADOS_INTENTOS', { reintentar_en_seg: 540 }, 'Demasiadas subidas de foto. Vuelve a intentarlo en 9 minutos'],
  ])('muestra el error %s del back-end y permite reintentar', async (codigo, extra, texto) => {
    vi.mocked(api.subirFotoPerfil).mockRejectedValue(errorApi(codigo, extra))
    montar('/panel/configuracion')
    await titulo()
    await userEvent.upload(screen.getByLabelText('Archivo de foto de perfil'), archivo())
    await userEvent.click(screen.getByRole('button', { name: 'Guardar foto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(screen.getByRole('button', { name: 'Guardar foto' })).toBeEnabled()
    expect(screen.getByAltText('Vista previa de tu nueva foto')).toBeInTheDocument() // no pierde la selección
  }, ESPERA_TEST)

  it('sin doble envío: mientras se sube, el botón queda deshabilitado y un segundo clic no repite la petición', async () => {
    let resolver
    vi.mocked(api.subirFotoPerfil).mockReturnValue(new Promise((r) => (resolver = r)))
    montar('/panel/configuracion')
    await titulo()
    await userEvent.upload(screen.getByLabelText('Archivo de foto de perfil'), archivo())
    const guardar = screen.getByRole('button', { name: 'Guardar foto' })
    fireEvent.click(guardar)
    fireEvent.click(guardar)
    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled()
    expect(api.subirFotoPerfil).toHaveBeenCalledTimes(1)
    resolver(perfilConFoto())
    expect(await screen.findByText('Foto actualizada')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('"Quitar foto" (con estado de carga) vuelve a las iniciales y avisa', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilConFoto())
    let resolver
    vi.mocked(api.quitarFotoPerfil).mockReturnValue(new Promise((r) => (resolver = r)))
    montar('/panel/configuracion')
    await titulo()
    expect(within(lateral()).getByAltText(/foto de leo/i)).toBeInTheDocument()

    const quitar = screen.getByRole('button', { name: 'Quitar foto' })
    fireEvent.click(quitar)
    fireEvent.click(quitar)
    expect(await screen.findByRole('button', { name: 'Quitando...' })).toBeDisabled()
    expect(api.quitarFotoPerfil).toHaveBeenCalledTimes(1)

    resolver(perfilBarbero())
    expect(await screen.findByText('Foto quitada. Se muestra tu foto pública')).toBeInTheDocument()
    expect(within(lateral()).getByRole('img', { name: 'Avatar de Leo' })).toHaveTextContent('L')
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).toBeNull()
  }, ESPERA_TEST)

  it('un error al cargar el perfil ofrece Reintentar', async () => {
    vi.mocked(api.obtenerPerfil).mockRejectedValueOnce(new Error('No se pudo conectar con el servidor'))
    montar('/panel/configuracion')
    expect(await screen.findByRole('alert', {}, { timeout: ESPERA })).toHaveTextContent('No se pudo conectar con el servidor')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await titulo()
    expect(api.obtenerPerfil).toHaveBeenCalledTimes(2)
  }, ESPERA_TEST)

  it('el menú de usuario ofrece "Configuración" y lleva a la página', async () => {
    const router = montar('/panel')
    await screen.findByRole('heading', { level: 1, name: /Hola, Leo/ }, { timeout: ESPERA })
    await userEvent.click(screen.getByRole('button', { name: /Menú de usuario/ }))
    await userEvent.click(within(document.getElementById('menu-usuario')).getByRole('link', { name: 'Configuración' }))
    await titulo()
    expect(router.state.location.pathname).toBe('/panel/configuracion')
  }, ESPERA_TEST)

  it('el perfil se pide una vez y NO hay polling', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      montar('/panel/configuracion')
      await titulo()
      expect(api.obtenerPerfil).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(api.obtenerPerfil).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  }, ESPERA_TEST)
})

describe('Contraseña caducada: el perfil no se pide', () => {
  it('con la contraseña caducada (tras recargar) se muestra la pantalla obligatoria y nunca se llama a /perfil', async () => {
    sesion('barbero')
    vi.mocked(api.obtenerSesion).mockResolvedValue({ usuario: {}, vigencia: CADUCADA })
    montar('/panel/configuracion')
    expect(await screen.findByRole('heading', { name: /caduc/i }, { timeout: ESPERA })).toBeInTheDocument()
    expect(api.obtenerPerfil).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { level: 1, name: 'Configuración' })).toBeNull()
  }, ESPERA_TEST)

  it('con la contraseña vigente sí se pide, una vez', async () => {
    sesion('barbero')
    montar('/panel/configuracion')
    await titulo()
    expect(api.obtenerPerfil).toHaveBeenCalledTimes(1)
  }, ESPERA_TEST)
})

describe('/admin/configuracion (administrador)', () => {
  beforeEach(() => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilAdmin())
  })

  it('usa la misma página: nombre por defecto = usuario, sin foto pública', async () => {
    sesion('admin')
    montar('/admin/configuracion')
    await titulo()
    expect(screen.getByText('Nombre por defecto').nextElementSibling).toHaveTextContent('admin_acceso')
    expect(screen.getByText('Usuario de acceso').nextElementSibling).toHaveTextContent('admin_acceso')
    expect(within(screen.getByLabelText('Menú de navegación')).getByRole('link', { name: 'Configuración' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('img', { name: 'Avatar de admin_acceso' })).toBeInTheDocument()
  }, ESPERA_TEST)

  it('guardar el nombre actualiza el menú de usuario; subir foto pone la foto en el avatar del menú', async () => {
    sesion('admin')
    vi.mocked(api.actualizarPerfil).mockResolvedValue(perfilAdmin({ nombre: 'Jefe', nombre_perfil: 'Jefe', usa_nombre_publico: false }))
    vi.mocked(api.subirFotoPerfil).mockResolvedValue(perfilAdmin({ nombre: 'Jefe', nombre_perfil: 'Jefe', usa_nombre_publico: false, foto_url: `/api/perfil/foto/${UUID}.webp`, foto_propia: true }))
    montar('/admin/configuracion')
    await titulo()
    expect(screen.getByRole('button', { name: 'Menú de usuario de admin_acceso' })).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de perfil' }), 'Jefe')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Nombre actualizado')).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Menú de usuario de Jefe' })
    expect(boton).toBeInTheDocument()
    expect(within(boton).queryByRole('img')).toBeNull() // aún sin foto: iniciales

    await userEvent.upload(screen.getByLabelText('Archivo de foto de perfil'), archivo('a.webp', 'image/webp'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar foto' }))
    await screen.findByText('Foto actualizada')
    expect(within(screen.getByRole('button', { name: 'Menú de usuario de Jefe' })).getByAltText('Foto de Jefe')).toHaveAttribute(
      'src',
      resolverUrlFoto({ foto_url: `/api/perfil/foto/${UUID}.webp`, foto_propia: true })
    )
  }, ESPERA_TEST)

  it('si la foto del menú no carga, vuelve a las iniciales', async () => {
    sesion('admin')
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilAdmin({ foto_url: `/api/perfil/foto/${UUID}.png`, foto_propia: true }))
    montar('/admin/configuracion')
    await titulo()
    const boton = screen.getByRole('button', { name: /Menú de usuario/ })
    fireEvent.error(within(boton).getByAltText('Foto de admin_acceso'))
    expect(within(boton).queryByRole('img')).toBeNull()
    expect(boton).toHaveTextContent('AD')
  }, ESPERA_TEST)

  it('el menú de usuario del admin ofrece Configuración, Cambiar contraseña y Cerrar sesión', async () => {
    sesion('admin')
    montar('/admin/configuracion')
    await titulo()
    await userEvent.click(screen.getByRole('button', { name: /Menú de usuario/ }))
    const menu = document.getElementById('menu-usuario')
    expect(within(menu).getByRole('link', { name: 'Configuración' })).toHaveAttribute('href', '/admin/configuracion')
    expect(within(menu).getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('La web pública NO usa el perfil', () => {
  const BARBEROS = [
    { id: 2, nombre: 'Leo', cargo: 'Barbero Senior', especialidad: 'Fade', foto: '/Barberos/leo.jpg' },
    { id: 3, nombre: 'Ana Ríos', cargo: 'Barbero Profesional', especialidad: 'Barba', foto: null },
  ]
  const OTRO_PERFIL = perfilConFoto({ nombre: 'NOMBRE DE PERFIL', nombre_perfil: 'NOMBRE DE PERFIL', usa_nombre_publico: false })

  it('Nuestro Equipo sigue leyendo barberos.nombre y barberos.foto aunque el perfil tenga otros valores', async () => {
    sesion('barbero')
    vi.mocked(api.obtenerBarberos).mockResolvedValue(BARBEROS)
    vi.mocked(api.obtenerPerfil).mockResolvedValue(OTRO_PERFIL)
    const { container } = render(
      <AuthProvider>
        <ProveedorPerfil token="tok" nombrePublico="Leo">
          <MemoryRouter>
            <NuestrosColaboradores />
          </MemoryRouter>
        </ProveedorPerfil>
      </AuthProvider>
    )
    expect(await screen.findByRole('heading', { level: 3, name: 'Leo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Ana Ríos' })).toBeInTheDocument()
    expect(container.querySelector('img[src="/Barberos/leo.jpg"]')).not.toBeNull()
    expect(container.textContent).not.toContain('NOMBRE DE PERFIL')
    expect(container.querySelector(`img[src*="${UUID}"]`)).toBeNull()
    expect(screen.getByRole('img', { name: 'Avatar de Ana Ríos' })).toBeInTheDocument()
  })

  it('PasoBarbero sigue mostrando barberos.nombre y barberos.foto', () => {
    render(<PasoBarbero barberos={BARBEROS} barberoIdSeleccionado={null} onSeleccionar={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Leo' })).toBeInTheDocument()
    expect(screen.getByAltText(/foto de leo/i)).toHaveAttribute('src', '/Barberos/leo.jpg')
    expect(screen.getByRole('img', { name: 'Avatar de Ana Ríos' })).toBeInTheDocument()
  })

  it('las páginas y componentes públicos ni importan el perfil ni lo piden (guarda estática)', () => {
    const fuentes = {
      ...import.meta.glob('../components/sections/**/*.jsx', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../components/layout/**/*.jsx', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../pages/{Home,Cortes,ReservaCorte,NotFound,Landingpage}.jsx', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../hooks/useBarberosActivos.js', { query: '?raw', import: 'default', eager: true }),
    }
    expect(Object.keys(fuentes).length).toBeGreaterThan(10)
    for (const [ruta, codigo] of Object.entries(fuentes)) {
      expect(codigo, ruta).not.toMatch(/PerfilContext|obtenerPerfil|usePerfil|utils\/perfil|foto_perfil|nombre_perfil/)
    }
  })

  it('al abrir páginas públicas no se llama a /perfil', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue(BARBEROS)
    render(
      <MemoryRouter>
        <NuestrosColaboradores />
      </MemoryRouter>
    )
    await screen.findByRole('heading', { level: 3, name: 'Leo' })
    expect(api.obtenerPerfil).not.toHaveBeenCalled()
  })
})
