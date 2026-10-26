import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppRouter from '../routes/AppRouter'
import { AuthProvider } from '../context/AuthContext'
import DatosResponsable from '../components/legal/DatosResponsable'
import PoliticaPrivacidad from '../pages/legal/PoliticaPrivacidad'
import TratamientoDatos from '../pages/legal/TratamientoDatos'
import PoliticaCookies from '../pages/legal/PoliticaCookies'
import { ELEMENTOS_ALMACENAMIENTO } from '../data/almacenamiento'
import { LEGAL, NOMBRES_LEGALES, RUTAS_LEGALES } from '../data/legal'
import { reiniciarConsentimiento } from '../utils/consentimiento'
import * as api from '../services/api'

vi.mock('../services/api')

const ESPERA_CARGA = 10_000
const ESPERA_TEST = 20_000

const montarPagina = (Pagina) =>
  render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>
  )

beforeEach(() => {
  localStorage.clear()
  reiniciarConsentimiento()
})

describe('configuración legal', () => {
  it('razón social, NIT y teléfono quedan vacíos (no se inventan); domicilio y correo salen del pie de página', () => {
    expect(LEGAL.razonSocial).toBe('')
    expect(LEGAL.nit).toBe('')
    expect(LEGAL.telefono).toBe('')
    expect(LEGAL.domicilio).toMatch(/Calle 22/)
    expect(LEGAL.correo).toMatch(/@/)
  })
})

describe('DatosResponsable', () => {
  it('muestra solo los campos con valor', () => {
    render(<DatosResponsable />)

    expect(screen.getByText('Nombre comercial')).toBeInTheDocument()
    expect(screen.getByText('Domicilio')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: LEGAL.correo })).toHaveAttribute('href', `mailto:${LEGAL.correo}`)
    expect(screen.queryByText('Razón social')).not.toBeInTheDocument()
    expect(screen.queryByText('NIT')).not.toBeInTheDocument()
    expect(screen.queryByText('Teléfono')).not.toBeInTheDocument()
  })

  it('con valores configurados los muestra todos', () => {
    render(<DatosResponsable legal={{ ...LEGAL, razonSocial: 'Empresa de Prueba S.A.S.', nit: '000.000.000-0', telefono: '3000000000' }} />)

    expect(screen.getByText('Razón social')).toBeInTheDocument()
    expect(screen.getByText('Empresa de Prueba S.A.S.')).toBeInTheDocument()
    expect(screen.getByText('NIT')).toBeInTheDocument()
    expect(screen.getByText('Teléfono')).toBeInTheDocument()
  })

  it('un campo con solo espacios no aparece', () => {
    render(<DatosResponsable legal={{ ...LEGAL, nit: '   ' }} />)
    expect(screen.queryByText('NIT')).not.toBeInTheDocument()
  })
})

describe.each([
  ['Política de Tratamiento de Datos Personales', TratamientoDatos, NOMBRES_LEGALES.datos, ['Responsable del tratamiento', 'Derechos del titular', 'Consultas y reclamos']],
  ['Política de Privacidad', PoliticaPrivacidad, NOMBRES_LEGALES.privacidad, ['Quiénes somos', 'Qué datos te pedimos', 'Tus derechos y cómo ejercerlos']],
  ['Política de Cookies', PoliticaCookies, NOMBRES_LEGALES.cookies, ['Qué son las cookies y el almacenamiento local', 'Cambiar o retirar tu consentimiento']],
])('%s', (titulo, Pagina, nombre, secciones) => {
  it('renderiza su título (único h1), versión y fecha, y sus secciones', () => {
    montarPagina(Pagina)

    expect(screen.getByRole('heading', { level: 1, name: nombre })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText(/Versión 1\.0 · Última actualización: 26 de octubre de 2026/)).toBeInTheDocument()
    secciones.forEach((seccion) => {
      expect(screen.getByRole('heading', { level: 2, name: new RegExp(seccion) })).toBeInTheDocument()
    })
  })

  it('tiene un índice con anclas a cada sección', () => {
    montarPagina(Pagina)
    const indice = screen.getByRole('navigation', { name: 'Contenido' })
    const enlaces = within(indice).getAllByRole('link')
    const secciones = screen.getAllByRole('region')
    expect(enlaces).toHaveLength(secciones.length)
    enlaces.forEach((enlace) => {
      const id = new URL(enlace.getAttribute('href'), 'http://localhost').hash.slice(1)
      expect(document.getElementById(id)).toBeInTheDocument()
    })
  })

  it('pone el título y la descripción propios de la página', () => {
    montarPagina(Pagina)
    expect(document.title).toBe(`${nombre} | ${LEGAL.nombreComercial}`)
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(/Black Iron Barbers/)
  })

  it('no muestra razón social ni NIT mientras estén vacíos', () => {
    montarPagina(Pagina)
    expect(screen.queryByText('Razón social')).not.toBeInTheDocument()
    expect(screen.queryByText('NIT')).not.toBeInTheDocument()
  })
})

describe('Política de Tratamiento de Datos Personales: contenido mínimo', () => {
  it('cita la Ley 1581 de 2012 y el Decreto 1074 de 2015, los plazos y la SIC', () => {
    montarPagina(TratamientoDatos)
    const texto = document.body.textContent
    expect(texto).toMatch(/Ley 1581 de 2012/)
    expect(texto).toMatch(/Decreto 1074 de\s+2015/)
    expect(texto).toMatch(/10 días hábiles/)
    expect(texto).toMatch(/5 días hábiles/)
    expect(texto).toMatch(/15 días hábiles/)
    expect(texto).toMatch(/8 días hábiles/)
    expect(texto).toMatch(/Superintendencia de Industria y Comercio/)
    expect(texto).toMatch(/Estados\s+Unidos/)
    expect(screen.getByRole('heading', { level: 2, name: /Niños, niñas y adolescentes/ })).toBeInTheDocument()
  })
})

describe('Política de Cookies: tabla y panel incrustado', () => {
  it('lista exactamente lo que usa el sitio, con su categoría', () => {
    montarPagina(PoliticaCookies)
    const tabla = screen.getByRole('table', { name: /guarda el sitio/ })
    const filas = within(tabla).getAllByRole('row').slice(1)

    expect(filas).toHaveLength(ELEMENTOS_ALMACENAMIENTO.length)
    const claves = filas.map((fila) => within(fila).getAllByRole('cell')[0].textContent.replace(/^Nombre o clave/, ''))
    expect(claves).toEqual(['consentimiento-cookies', 'seleccion-servicios', 'pulso-cliente-nuevo', 'token', 'bienvenida-barbero-vista', '_ga', '_ga_<ID>'])
    const analiticas = filas.filter((fila) => /Analítica$/.test(within(fila).getAllByRole('cell')[4].textContent))
    expect(analiticas).toHaveLength(2)
  })

  it('incrusta el panel de configuración con sus interruptores y botones', () => {
    montarPagina(PoliticaCookies)
    expect(screen.getByRole('switch', { name: 'Necesarias' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Analíticas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar preferencias' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceptar todas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rechazar todas' })).toBeInTheDocument()
  })
})

describe('coherencia con el código', () => {
  // La tabla de cookies debe listar TODAS las claves de almacenamiento del código (y solo esas).
  const fuentes = import.meta.glob(['../**/*.js', '../**/*.jsx', '!../tests/**', '!../data/almacenamiento.js'], {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  it('las claves de localStorage/sessionStorage del código coinciden con la tabla de la política', () => {
    const encontradas = new Set()
    for (const texto of Object.values(fuentes).filter((t) => /(?:local|session)Storage/.test(t))) {
      for (const [, clave] of texto.matchAll(/(?:local|session)Storage\.\w+Item\('([^']+)'/g)) encontradas.add(clave)
      for (const [, clave] of texto.matchAll(/const CLAVE\w* = '([^']+)'/g)) encontradas.add(clave)
    }
    const listadas = new Set(ELEMENTOS_ALMACENAMIENTO.filter((e) => e.tipo.endsWith('Storage')).map((e) => e.clave))
    expect([...encontradas].sort()).toEqual([...listadas].sort())
  })

  it('el código no escribe cookies propias (solo analitica.js las borra)', () => {
    const conCookies = Object.entries(fuentes).filter(([ruta, texto]) => /document\.cookie\s*=/.test(texto) && !ruta.endsWith('utils/analitica.js'))
    expect(conCookies).toEqual([])
  })
})

describe('rutas legales', () => {
  beforeEach(() => {
    vi.mocked(api.obtenerBarberos).mockResolvedValue([])
    vi.mocked(api.obtenerServicios).mockResolvedValue([])
  })

  it.each([
    [RUTAS_LEGALES.privacidad, NOMBRES_LEGALES.privacidad],
    [RUTAS_LEGALES.datos, NOMBRES_LEGALES.datos],
    [RUTAS_LEGALES.cookies, NOMBRES_LEGALES.cookies],
  ])('%s se muestra con el menú, el pie y su único h1', async (ruta, titulo) => {
    const router = createMemoryRouter(AppRouter.routes, { initialEntries: [ruta] })
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    )

    expect(await screen.findByRole('heading', { level: 1, name: titulo }, { timeout: ESPERA_CARGA })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Aviso de cookies' })).toBeInTheDocument()
  }, ESPERA_TEST)
})
