import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PanelLayout from '../pages/panel/PanelLayout'
import { AuthProvider, useAuth } from '../context/AuthContext'
import ListaEmpleados from '../components/admin/ListaEmpleados'
import * as api from '../services/api'

vi.mock('../services/api')
vi.mock('../context/AuthContext', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, useAuth: vi.fn(real.useAuth) }
})

const RESUMEN_VACIO = {
  fecha: '2026-10-04', citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null,
  ingresos_hoy: 0, cortes_mes: 0, ingresos_mes: 0, por_confirmar: 0,
}
const POR_VENCER = { estado: 'por_vencer', dias_restantes: 2, vence_en: '2026-12-03' }
const CADUCADA = { estado: 'caducada', dias_restantes: 0, vence_en: '2026-10-04' }
const VIGENTE = { estado: 'vigente', dias_restantes: 60, vence_en: '2026-12-03' }

let logout
let actualizarVigencia

const rutasPanel = (
  <MemoryRouter initialEntries={['/panel']}>
    <Routes>
      <Route path="/panel" element={<PanelLayout />}>
        <Route index element={<p>Contenido del panel</p>} />
      </Route>
      <Route path="/acceso" element={<p>Pantalla de acceso</p>} />
    </Routes>
  </MemoryRouter>
)

const montarPanel = (vigencia) => {
  logout = vi.fn()
  actualizarVigencia = vi.fn()
  vi.mocked(useAuth).mockReturnValue({ usuario: { usuario: 'leo', rol: 'barbero', barbero_id: 2 }, token: 't', logout, vigencia, actualizarVigencia })
  return render(rutasPanel)
}

const llenarFormulario = async (actual = 'actual123', nueva = 'nueva12345') => {
  await userEvent.type(screen.getByLabelText('Contraseña actual'), actual)
  await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), nueva)
  await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), nueva)
  await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
}

beforeEach(() => {
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 2, nombre: 'Leo', cargo: 'Barbero', foto: null }])
  vi.mocked(api.obtenerResumenBarbero).mockResolvedValue(RESUMEN_VACIO)
  vi.mocked(api.obtenerCitasPorConfirmar).mockResolvedValue({ total: 0, tope: 100, items: [] })
})

describe('Panel del barbero según la caducidad de su contraseña', () => {
  it('vigente: no hay aviso ni opción para cambiar la contraseña (el cambio libre ya no existe)', async () => {
    montarPanel(VIGENTE)
    expect(await screen.findByText('Contenido del panel')).toBeInTheDocument()
    expect(screen.queryByText(/caduca en/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cambiar contraseña/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
  })

  it('por vencer: avisa con los días que faltan y el formulario solo aparece al pedirlo', async () => {
    montarPanel(POR_VENCER)
    const aviso = await screen.findByText(/Tu contraseña caduca en 2 días/)
    expect(aviso.closest('[role="status"]')).not.toBeNull() // aria-live para lectores de pantalla
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
  })

  it('por vencer, con 1 día: usa el singular', async () => {
    montarPanel({ ...POR_VENCER, dias_restantes: 1 })
    expect(await screen.findByText(/caduca en 1 día\./)).toBeInTheDocument()
  })

  it('por vencer: cambiarla llama a la API y actualiza el estado con la respuesta', async () => {
    vi.mocked(api.cambiarContrasena).mockResolvedValue({ mensaje: 'ok', vigencia: VIGENTE })
    montarPanel(POR_VENCER)
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
    await llenarFormulario()

    expect(api.cambiarContrasena).toHaveBeenCalledWith('t', 'actual123', 'nueva12345')
    await waitFor(() => expect(actualizarVigencia).toHaveBeenCalledWith(VIGENTE))
  })

  it('por vencer: muestra el error del back-end junto al campo (contraseña actual incorrecta)', async () => {
    vi.mocked(api.cambiarContrasena).mockRejectedValue(
      Object.assign(new Error('La contraseña actual no es correcta'), { codigo: 'CONTRASENA_ACTUAL_INCORRECTA', campo: 'actual' })
    )
    montarPanel(POR_VENCER)
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
    await llenarFormulario('mala-clave1')

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta')
    expect(actualizarVigencia).not.toHaveBeenCalled()
  })

  it('no deja guardar una nueva igual a la actual (sin llamar a la API)', async () => {
    montarPanel(POR_VENCER)
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
    await llenarFormulario('misma-clave1', 'misma-clave1')
    expect(await screen.findByText('La nueva contraseña debe ser distinta de la actual')).toBeInTheDocument()
    expect(api.cambiarContrasena).not.toHaveBeenCalled()
  })

  it('caducada: pantalla obligatoria sin el resto del panel, ni siquiera se piden las citas', async () => {
    montarPanel(CADUCADA)
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu contraseña caducó' })).toHaveFocus()
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.queryByText('Contenido del panel')).not.toBeInTheDocument()
    expect(api.obtenerResumenBarbero).not.toHaveBeenCalled()
  })

  it('caducada: se puede cerrar sesión y lleva al acceso', async () => {
    montarPanel(CADUCADA)
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(logout).toHaveBeenCalled()
    expect(screen.getByText('Pantalla de acceso')).toBeInTheDocument()
  })

  it('caducada: al cambiarla se actualiza el estado para volver al panel', async () => {
    vi.mocked(api.cambiarContrasena).mockResolvedValue({ mensaje: 'ok', vigencia: VIGENTE })
    montarPanel(CADUCADA)
    await screen.findByLabelText('Contraseña actual')
    await llenarFormulario()
    await waitFor(() => expect(actualizarVigencia).toHaveBeenCalledWith(VIGENTE))
  })

  it('estado aún desconocido (página recargada): consulta /auth/sesion antes de mostrar nada', async () => {
    vi.mocked(api.obtenerSesion).mockResolvedValue({ usuario: {}, vigencia: POR_VENCER })
    montarPanel(undefined)
    expect(screen.queryByText('Contenido del panel')).not.toBeInTheDocument()
    await waitFor(() => expect(actualizarVigencia).toHaveBeenCalledWith(POR_VENCER))
    expect(api.obtenerSesion).toHaveBeenCalledWith('t')
  })
})

// Integración con el AuthProvider real y la capa HTTP real (solo se simula fetch).
describe('403 CONTRASENA_CADUCADA lleva a la pantalla de cambio, no al login', () => {
  const respuesta = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo })

  beforeEach(async () => {
    const real = await vi.importActual('../services/api')
    for (const nombre of ['obtenerSesion', 'obtenerResumenBarbero', 'obtenerCitasPorConfirmar', 'obtenerBarberos', 'setContrasenaCaducadaHandler', 'setUnauthorizedHandler']) {
      vi.mocked(api)[nombre].mockImplementation(real[nombre])
    }
    const payload = { id: 1, usuario: 'leo', rol: 'barbero', barbero_id: 2, exp: Math.floor(Date.now() / 1000) + 3600 }
    localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
    const contexto = await vi.importActual('../context/AuthContext')
    vi.mocked(useAuth).mockImplementation(contexto.useAuth)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('una llamada del panel recibe 403 y aparece la pantalla obligatoria, con la sesión intacta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        String(url).endsWith('/auth/sesion')
          ? respuesta(200, { usuario: {}, vigencia: VIGENTE })
          : String(url).endsWith('/barberos')
            ? respuesta(200, [])
            : respuesta(403, { error: 'Tu contraseña caducó', codigo: 'CONTRASENA_CADUCADA' })
      )
    )
    render(<AuthProvider>{rutasPanel}</AuthProvider>)

    expect(await screen.findByRole('heading', { level: 1, name: 'Tu contraseña caducó' })).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de acceso')).not.toBeInTheDocument()
    expect(localStorage.getItem('token')).not.toBeNull() // no se cerró la sesión
  })
})

describe('Indicador de contraseña en /admin/empleados', () => {
  const empleado = (id, nombre, vigencia) => ({
    id, nombre, cargo: 'Barbero', especialidad: null, foto: null, activo: true,
    usuario: { id: id * 10, usuario: nombre.toLowerCase(), activo: true, vigencia },
    usuarios_total: 1, cortes_mes: 0, citas_pendientes: 0,
  })
  const EMPLEADOS = [
    empleado(1, 'Uno', VIGENTE),
    empleado(2, 'Dos', POR_VENCER),
    empleado(3, 'Tres', CADUCADA),
    { ...empleado(4, 'Cuatro'), usuario: null, usuarios_total: 0 },
  ]

  it.each([
    ['tabla', true],
    ['tarjetas móviles', false],
  ])('%s: muestra vigente, "caduca en N días" y caducada, y nada si no hay acceso', (_nombre, tabla) => {
    render(
      <MemoryRouter>
        <ListaEmpleados empleados={EMPLEADOS} tabla={tabla} alEditar={() => {}} alAcceso={() => {}} alCambiarActivo={() => {}} idGuardando={null} />
      </MemoryRouter>
    )
    expect(screen.getAllByText('Vigente')).toHaveLength(1)
    expect(screen.getAllByText('Caduca en 2 días')).toHaveLength(1)
    expect(screen.getAllByText('Caducada')).toHaveLength(1)
    expect(screen.getAllByText('Contraseña:', { exact: false })).toHaveLength(3)
  })
})
