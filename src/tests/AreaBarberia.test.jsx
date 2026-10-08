import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ReservaCorte from '../pages/ReservaCorte'
import NuestrosColaboradores from '../components/sections/NuestrosColaboradores'
import { ProveedorCarrito } from '../context/CarritoContext'
import useCantidadBarberos, { reiniciarCacheBarberos } from '../hooks/useCantidadBarberos'
import { enlaceReserva, textoReserva } from '../utils/equipo'
import { AREA_ASESORIA, AREA_BARBERIA, esDeBarberia, soloBarberia, vocabularioPanel } from '../utils/areas'
import * as api from '../services/api'

vi.mock('../services/api')

// Fase 2 de asesorías: el flujo de cortes solo ve barbería (servicios y barberos), el equipo muestra a todos.

const BOBY = { id: 1, nombre: 'Boby', cargo: 'Barbero Senior', especialidad: 'Fade', foto: null, area: 'barberia' }
const LEO = { id: 2, nombre: 'Leo', cargo: 'Barbero Profesional', especialidad: 'Barba', foto: null, area: 'barberia' }
const CAMILA = { id: 9, nombre: 'Camila', cargo: 'Asesora de Imagen', especialidad: 'Asesoria', foto: null, area: 'asesoria' }
const CORTE = {
  id: 1,
  nombre: 'Corte clasico',
  descripcion: 'Corte tradicional',
  tipo: 'original',
  duracion_min: 30,
  precio: 18000,
  categoria: { id: 1, nombre: 'Cortes', slug: 'cortes' },
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  reiniciarCacheBarberos()
  vi.mocked(api.obtenerServicios).mockResolvedValue([CORTE])
  vi.mocked(api.obtenerBarberos).mockResolvedValue([BOBY, CAMILA, LEO])
  vi.mocked(api.obtenerDisponibilidad).mockResolvedValue({ horas: ['10:00'] })
})

describe('utils/areas', () => {
  it('quien llega sin area es de barbería (igual que el DEFAULT de la base)', () => {
    expect(esDeBarberia({ id: 1 })).toBe(true);
    expect(esDeBarberia({ area: 'barberia' })).toBe(true)
    expect(esDeBarberia({ area: 'asesoria' })).toBe(false)
    expect(esDeBarberia(null)).toBe(true)
  })

  it('soloBarberia deja a los barberos y quita a la asesora; no rompe con lo que no es lista', () => {
    expect(soloBarberia([BOBY, CAMILA, LEO]).map((b) => b.nombre)).toEqual(['Boby', 'Leo'])
    expect(soloBarberia([{ id: 5 }]).map((b) => b.id)).toEqual([5])
    expect(soloBarberia(undefined)).toBeUndefined()
  })

  it('las constantes de área coinciden con las del back-end', () => {
    expect(AREA_BARBERIA).toBe('barberia')
    expect(AREA_ASESORIA).toBe('asesoria')
  })

  it('vocabularioPanel: cortes por defecto y asesorías para quien atiende asesorías', () => {
    expect(vocabularioPanel('barberia')).toMatchObject({ etiquetaTotal: 'Cortes', delMes: 'Cortes del mes', unidad: 'corte', unidades: 'cortes' })
    expect(vocabularioPanel(undefined).delMes).toBe('Cortes del mes')
    expect(vocabularioPanel(null).etiquetaTotal).toBe('Cortes')
    expect(vocabularioPanel('asesoria')).toMatchObject({
      etiquetaTotal: 'Asesorías',
      delMes: 'Asesorías del mes',
      unidad: 'asesoría',
      unidades: 'asesorías',
      sinCompletadas: 'No tienes asesorías completadas en este período.',
    })
  })
})

describe('Guarda: el flujo de cortes siempre pide area=barberia', () => {
  const fuentes = import.meta.glob(['../**/*.js', '../**/*.jsx', '!../tests/**'], { query: '?raw', import: 'default', eager: true })
  const archivos = Object.entries(fuentes).filter(([ruta]) => !ruta.endsWith('/services/api.js'))

  // Llamadas `obtenerServicios(...)` (con su argumento) que no son una importación.
  const llamadas = (texto) => [...texto.matchAll(/\bobtenerServicios\(([^)]*)\)/g)].map((m) => m[1])

  it('encuentra las llamadas de la carta, el carrito y la reserva', () => {
    const conLlamadas = archivos.filter(([, texto]) => llamadas(texto).length > 0).map(([ruta]) => ruta.replace('../', ''))
    expect(conLlamadas.sort()).toEqual(['components/sections/CatalogoServicios.jsx', 'context/CarritoContext.jsx', 'pages/ReservaCorte.jsx'])
  })

  it('ninguna llamada a obtenerServicios omite area', () => {
    for (const [ruta, texto] of archivos) {
      for (const argumento of llamadas(texto)) {
        expect(argumento, `${ruta} llama a obtenerServicios(${argumento}) sin area`).toMatch(/\barea\s*:\s*AREA_BARBERIA\b/)
      }
    }
  })

  it('todo el que lee obtenerBarberos filtra por área o está en la lista de quienes necesitan a todos', () => {
    // Necesitan a TODO el personal a propósito: "Nuestro Equipo" (muestra a la asesora) y useBarberosActivos (el panel
    // busca el perfil de quien inició sesión, sea barbero o asesora; el admin filtra citas por cualquiera de ellos).
    const TODOS = ['components/sections/NuestrosColaboradores.jsx', 'hooks/useBarberosActivos.js']
    const sinImportaciones = (texto) => texto.replace(/import[\s\S]*?from\s+['"][^'"]+['"]/g, '')
    const usan = archivos
      .filter(([, texto]) => /\bobtenerBarberos\b/.test(sinImportaciones(texto)))
      .map(([ruta, texto]) => [ruta.replace('../', ''), texto])
    expect(usan.map(([ruta]) => ruta).sort()).toEqual(['components/sections/NuestrosColaboradores.jsx', 'hooks/useBarberosActivos.js', 'hooks/useCantidadBarberos.js', 'pages/ReservaCorte.jsx'])
    for (const [ruta, texto] of usan) {
      if (!TODOS.includes(ruta)) expect(texto, `${ruta} debe filtrar con soloBarberia`).toMatch(/\bsoloBarberia\(/)
    }
  })
})

describe('ReservaCorte solo ofrece barbería', () => {
  const renderConRuta = (ruta) =>
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <ProveedorCarrito>
          <ReservaCorte />
        </ProveedorCarrito>
      </MemoryRouter>
    )
  const irAlPasoBarbero = async (user) => {
    await screen.findByRole('button', { name: /corte clasico/i })
    await user.click(screen.getAllByRole('button', { name: /^continuar$/i })[0])
    await screen.findByRole('heading', { name: /cualquier barbero/i })
  }

  it('pide los servicios con area=barberia', async () => {
    renderConRuta('/reservar-corte?servicio=1')
    await screen.findByRole('button', { name: /corte clasico/i })
    expect(api.obtenerServicios).toHaveBeenCalledWith({ area: 'barberia' })
  })

  it('el paso Barbero lista a los barberos y no a la asesora', async () => {
    renderConRuta('/reservar-corte?servicio=1')
    await irAlPasoBarbero(userEvent.setup())

    expect(screen.getByRole('heading', { name: 'Boby' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leo' })).toBeInTheDocument()
    expect(screen.queryByText('Camila')).toBeNull()
    expect(screen.queryByText('Asesoria')).toBeNull()
  })

  it('un enlace viejo ?barbero=<asesora> vuelve a "Cualquier barbero" en vez de quedar sin elección', async () => {
    renderConRuta('/reservar-corte?servicio=1&barbero=9')
    await irAlPasoBarbero(userEvent.setup())

    expect(screen.getByRole('button', { name: /cualquier barbero/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /camila/i })).toBeNull()
  })

  it('un ?barbero=<barbero de barbería> sigue preseleccionado', async () => {
    renderConRuta('/reservar-corte?servicio=1&barbero=2')
    await irAlPasoBarbero(userEvent.setup())

    expect(screen.getByRole('button', { name: /leo/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /cualquier barbero/i })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Nuestro Equipo sigue mostrando a la asesora', () => {
  const montar = () =>
    render(
      <MemoryRouter>
        <NuestrosColaboradores />
      </MemoryRouter>
    )

  it('Camila aparece con su cargo; su botón lleva a las asesorías y el de los barberos a la reserva', async () => {
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Boby' })

    expect(screen.getByRole('heading', { level: 3, name: 'Camila' })).toBeInTheDocument()
    expect(screen.getAllByText('Asesora de Imagen').length).toBeGreaterThan(0) // en el filtro por cargo y en su tarjeta
    expect(screen.getByRole('link', { name: 'Ver asesorías' })).toHaveAttribute('href', '/asesorias')
    expect(screen.queryByRole('link', { name: 'Reservar con Camila' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Reservar con Boby' })).toHaveAttribute('href', '/reservar-corte?barbero=1')
    expect(screen.getByRole('link', { name: 'Reservar con Leo' })).toHaveAttribute('href', '/reservar-corte?barbero=2')
  })

  it('enlaceReserva y textoReserva según el área', () => {
    expect(enlaceReserva(CAMILA)).toBe('/asesorias')
    expect(textoReserva(CAMILA)).toBe('Ver asesorías')
    expect(enlaceReserva(BOBY)).toBe('/reservar-corte?barbero=1')
    expect(textoReserva(BOBY)).toBe('Reservar con Boby')
    expect(enlaceReserva({ id: 7, nombre: 'Sin area' })).toBe('/reservar-corte?barbero=7')
    expect(enlaceReserva(null)).toBe('/reservar-corte')
  })
})

describe('Conteo de barberos (hero y estadísticas)', () => {
  it('cuenta solo a los barberos de barbería: la asesora no suma', async () => {
    const { result } = renderHook(() => useCantidadBarberos())
    await waitFor(() => expect(result.current).toBe(2))
  })

  it('sin area en la respuesta (back-end anterior) cuenta a todos como antes', async () => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([{ id: 1, nombre: 'A' }, { id: 2, nombre: 'B' }, { id: 3, nombre: 'C' }])
    const { result } = renderHook(() => useCantidadBarberos())
    await waitFor(() => expect(result.current).toBe(3))
  })

  it('sigue dando 0 si la petición falla', async () => {
    vi.mocked(api.obtenerBarberos).mockRejectedValue(new Error('sin red'))
    const { result } = renderHook(() => useCantidadBarberos())
    await waitFor(() => expect(result.current).toBe(0))
  })
})
