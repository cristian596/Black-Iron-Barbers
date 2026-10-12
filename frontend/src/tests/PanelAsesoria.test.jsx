import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider, useAuth } from '../context/AuthContext'
import GraficoIngresos from '../components/admin/GraficoIngresos'
import { indicadoresBarbero, INDICADORES_BARBERO } from '../data/indicadoresBarbero'
import { vocabularioPanel } from '../utils/areas'
import * as api from '../services/api'
import { hoyISO } from '../utils/fechas'

vi.mock('../services/api')

// Fase 2 de asesorías: en /panel, quien atiende asesorías (area 'asesoria') ve "Asesorías" donde un barbero ve
// "Cortes". Solo cambian textos; las consultas y los permisos son los de siempre.

const ESPERA = 10_000
const ESPERA_TEST = 20_000
const VIGENTE = { estado: 'vigente', dias_restantes: 41, vence_en: '2026-11-14' }
const PERIODO = { clave: 'hoy', desde: '2026-10-04', hasta: '2026-10-04' }
const ANTERIOR = { desde: '2026-10-03', hasta: '2026-10-03' }
const CEROS = { citas: 0, completadas: 0, canceladas: 0, ingresos: 0, ticket_promedio: 0 }

// Sesión restaurada tras recargar: el JWT NO trae el área; llega con /auth/sesion.
const sesionGuardada = () => {
  const payload = { id: 1, usuario: 'camila', rol: 'barbero', barbero_id: 9, exp: Math.floor(Date.now() / 1000) + 3600 }
  localStorage.setItem('token', `x.${btoa(JSON.stringify(payload))}.y`)
}
const fijarEscritorio = () => {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
}
const responderSesion = (area) => {
  vi.mocked(api.obtenerSesion).mockImplementation(async () => ({ usuario: { id: 1, usuario: 'camila', rol: 'barbero', barbero_id: 9, area }, vigencia: VIGENTE }))
}

const montar = (ruta) => {
  const router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.setItem('bienvenida-barbero-vista', '1')
  sesionGuardada()
  fijarEscritorio()
  vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 9, nombre: 'Camila', cargo: 'Asesora de Imagen', especialidad: 'Asesoria', foto: null, area: 'asesoria' }])
  vi.mocked(api.obtenerResumenBarbero).mockResolvedValue({
    fecha: hoyISO(), citas_hoy: 0, completadas_hoy: 0, pendientes_hoy: 0, proxima_cita: null, ingresos_hoy: 0, cortes_mes: 3, ingresos_mes: 0, por_confirmar: 0,
  })
  vi.mocked(api.obtenerCitasPorConfirmar).mockResolvedValue({ total: 0, tope: 100, items: [] })
  vi.mocked(api.obtenerAgendaHoy).mockResolvedValue({ fecha: hoyISO(), citas: [] })
  vi.mocked(api.obtenerMisEstadisticas).mockResolvedValue({ periodo: PERIODO, anterior: ANTERIOR, actual: CEROS, previo: CEROS })
  vi.mocked(api.obtenerMisIngresos).mockResolvedValue({ agrupar: 'dia', puntos: [], anteriores: [] })
  vi.mocked(api.obtenerMisServiciosTop).mockResolvedValue({ periodo: PERIODO, servicios: [] })
})

afterEach(() => {
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('Textos del panel según el área', () => {
  it('Resumen: quien atiende asesorías ve "Asesorías del mes" (el dato es el mismo cortes_mes)', async () => {
    responderSesion('asesoria')
    montar('/panel')

    const etiqueta = await screen.findByText('Asesorías del mes', {}, { timeout: ESPERA })
    expect(etiqueta.parentElement).toHaveTextContent('3')
    expect(screen.queryByText('Cortes del mes')).toBeNull()
  }, ESPERA_TEST)

  it('Resumen: un barbero de barbería sigue viendo "Cortes del mes"', async () => {
    responderSesion('barberia')
    montar('/panel')

    expect(await screen.findByText('Cortes del mes', {}, { timeout: ESPERA })).toBeInTheDocument()
    expect(screen.queryByText('Asesorías del mes')).toBeNull()
  }, ESPERA_TEST)

  it('Mi rendimiento: la primera tarjeta dice "Asesorías" y el mensaje de vacío también', async () => {
    responderSesion('asesoria')
    montar('/panel/rendimiento')

    expect(await screen.findByText('No tienes asesorías completadas en este período.', {}, { timeout: ESPERA })).toBeInTheDocument()
    const region = screen.getByRole('region', { name: /Indicadores/ })
    expect(within(region).getAllByText(/^(Cortes|Asesorías|Ingresos|Ticket promedio|Canceladas)$/).map((e) => e.textContent)).toEqual([
      'Asesorías', 'Ingresos', 'Ticket promedio', 'Canceladas',
    ])
    expect(screen.queryByText('No tienes cortes completados en este período.')).toBeNull()
  }, ESPERA_TEST)

  it('Mi rendimiento: un barbero de barbería sigue viendo "Cortes"', async () => {
    responderSesion('barberia')
    montar('/panel/rendimiento')

    expect(await screen.findByText('No tienes cortes completados en este período.', {}, { timeout: ESPERA })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: /Indicadores/ })).getByText('Cortes')).toBeInTheDocument()
  }, ESPERA_TEST)

  it('sigue pidiendo SUS datos con las mismas funciones (solo cambian los textos)', async () => {
    responderSesion('asesoria')
    montar('/panel/rendimiento')
    await screen.findByText('No tienes asesorías completadas en este período.', {}, { timeout: ESPERA })

    expect(api.obtenerMisEstadisticas).toHaveBeenCalledWith(expect.any(String), 'hoy')
    expect(api.obtenerEstadisticas).not.toHaveBeenCalled()
  }, ESPERA_TEST)

  it('mientras no se conoce el área (o si falla /auth/sesion) el panel usa los textos de siempre', async () => {
    vi.mocked(api.obtenerSesion).mockRejectedValue(new Error('sin red'))
    montar('/panel')
    expect(await screen.findByText('Cortes del mes', {}, { timeout: ESPERA })).toBeInTheDocument()
  }, ESPERA_TEST)
})

describe('AuthContext guarda el área de la sesión', () => {
  const Entrar = ({ area }) => {
    const { login, usuario } = useAuth()
    return (
      <>
        <button type="button" onClick={() => login({ token: 'a.b.c', usuario: { id: 1, usuario: 'u', rol: 'barbero', barbero_id: 9, area }, vigencia: null })}>
          entrar
        </button>
        <output data-testid="area">{String(usuario?.area)}</output>
      </>
    )
  }

  it('el login la conserva (y null para el admin, que no tiene área)', async () => {
    localStorage.clear()
    const { rerender } = render(
      <AuthProvider>
        <Entrar area="asesoria" />
      </AuthProvider>
    )
    expect(screen.getByTestId('area')).toHaveTextContent('undefined')
    screen.getByRole('button', { name: 'entrar' }).click()
    await waitFor(() => expect(screen.getByTestId('area')).toHaveTextContent('asesoria'))

    localStorage.clear()
    rerender(
      <AuthProvider key="otra">
        <Entrar area={undefined} />
      </AuthProvider>
    )
    screen.getByRole('button', { name: 'entrar' }).click()
    await waitFor(() => expect(screen.getByTestId('area')).toHaveTextContent('null'))
  })
})

describe('vocabulario en los componentes compartidos', () => {
  it('indicadoresBarbero cambia solo la etiqueta de la primera tarjeta; INDICADORES_BARBERO sigue siendo el de cortes', () => {
    expect(indicadoresBarbero('asesoria').map((i) => i.etiqueta)).toEqual(['Asesorías', 'Ingresos', 'Ticket promedio', 'Canceladas'])
    // MODIFICADO (fase 6): la primera tarjeta ya no lee 'completadas' sino el contador de SU área (cortes o asesorias); las demás claves son las mismas
    expect(indicadoresBarbero('asesoria').map((i) => i.clave)).toEqual(['asesorias', ...INDICADORES_BARBERO.slice(1).map((i) => i.clave)])
    expect(INDICADORES_BARBERO[0].clave).toBe('cortes')
    expect(INDICADORES_BARBERO[0].etiqueta).toBe('Cortes')
  })

  const dia = (i) => `2026-09-${String(i + 1).padStart(2, '0')}`
  const puntos = Array.from({ length: 30 }, (_, i) => ({ fecha: dia(i), ingresos: i === 3 ? 80000 : 0, cortes: i === 3 ? 1 : 0 }))
  const anteriores = Array.from({ length: 30 }, (_, i) => ({ fecha: dia(i), ingresos: 0, cortes: 0 }))

  it('GraficoIngresos con vocabulario de asesorías: encabezado de la tabla y etiquetas dicen asesoría(s)', () => {
    const { container } = render(<GraficoIngresos agrupar="dia" puntos={puntos} anteriores={anteriores} vocabulario={vocabularioPanel('asesoria')} />)

    expect(screen.getByRole('columnheader', { name: 'Asesorías' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Cortes' })).toBeNull()
    const etiquetas = [...container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' | ')
    expect(etiquetas).toMatch(/1 asesoría\b/)
    expect(etiquetas).not.toMatch(/\bcortes?\b/)
  })

  it('GraficoIngresos sin vocabulario (admin y barbero) conserva "Cortes" y "corte(s)"', () => {
    const { container } = render(<GraficoIngresos agrupar="dia" puntos={puntos} anteriores={anteriores} />)
    expect(screen.getByRole('columnheader', { name: 'Cortes' })).toBeInTheDocument()
    const etiquetas = [...container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' | ')
    expect(etiquetas).toMatch(/1 corte\b/)
  })
})
