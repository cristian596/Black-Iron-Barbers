import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AnaliticaRutas from '../components/layout/AnaliticaRutas'
import { esRutaPrivada, idMedicion, reiniciarAnalitica } from '../utils/analitica'
import { guardarConsentimiento, reiniciarConsentimiento } from '../utils/consentimiento'

const ID = 'G-TEST123456'

const montar = (ruta = '/cortes') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AnaliticaRutas />
    </MemoryRouter>
  )

const scriptsGoogle = () => document.querySelectorAll('script[src*="googletagmanager.com"]')
// dataLayer guarda los `arguments` de gtag: se pasan a arreglos para poder compararlos.
const llamadas = () => (window.dataLayer ?? []).map((entrada) => Array.from(entrada))
const pageViews = () => llamadas().filter(([tipo, nombre]) => tipo === 'event' && nombre === 'page_view')

const limpiarCookies = () => {
  document.cookie.split(';').forEach((par) => {
    const nombre = par.split('=')[0].trim()
    if (nombre) document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })
}

beforeEach(() => {
  localStorage.clear()
  reiniciarConsentimiento()
  reiniciarAnalitica()
  document.head.querySelectorAll('script[src*="googletagmanager.com"]').forEach((s) => s.remove())
  delete window.gtag
  delete window.dataLayer
  delete window[`ga-disable-${ID}`]
  limpiarCookies()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('idMedicion y rutas privadas', () => {
  it('sin variable, vacía o con formato inválido no hay ID', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '')
    expect(idMedicion()).toBe('')
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'UA-123')
    expect(idMedicion()).toBe('')
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-</script>')
    expect(idMedicion()).toBe('')
  })

  it('acepta el formato G-XXXXXXXXXX', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', ` ${ID} `)
    expect(idMedicion()).toBe(ID)
  })

  it.each(['/acceso', '/panel', '/panel/citas', '/admin', '/admin/reportes', '/ADMIN/citas', '/panel/'])(
    '%s es privada',
    (ruta) => expect(esRutaPrivada(ruta)).toBe(true)
  )

  it.each(['/', '/cortes', '/reservar-corte', '/politica-de-cookies', '/administracion', '/panelista'])(
    '%s es pública',
    (ruta) => expect(esRutaPrivada(ruta)).toBe(false)
  )
})

describe('Google Analytics: sin ID de medición', () => {
  it('con consentimiento no hace nada: ni script, ni gtag, ni dataLayer, ni errores', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '')
    guardarConsentimiento({ analiticas: true })

    expect(() => montar()).not.toThrow()

    expect(scriptsGoogle()).toHaveLength(0)
    expect(window.gtag).toBeUndefined()
    expect(window.dataLayer).toBeUndefined()
  })
})

describe('Google Analytics: con ID de medición', () => {
  beforeEach(() => vi.stubEnv('VITE_GA_MEASUREMENT_ID', ID))

  it('SIN decisión no inyecta ningún script ni llama a gtag', () => {
    montar()
    expect(scriptsGoogle()).toHaveLength(0)
    expect(window.gtag).toBeUndefined()
    expect(window.dataLayer).toBeUndefined()
  })

  it('con el rechazo guardado tampoco carga nada, ni al cambiar de página', () => {
    guardarConsentimiento({ analiticas: false })
    montar('/cortes')
    expect(scriptsGoogle()).toHaveLength(0)
    expect(window.gtag).toBeUndefined()
  })

  it('al aceptar inyecta el script de gtag y lo configura sin página vista automática', () => {
    montar('/cortes')

    act(() => {
      guardarConsentimiento({ analiticas: true })
    })

    const scripts = scriptsGoogle()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].getAttribute('src')).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    expect(scripts[0].async).toBe(true)
    expect(typeof window.gtag).toBe('function')
    expect(llamadas()).toContainEqual(['config', ID, expect.objectContaining({ send_page_view: false })])
    expect(llamadas()).toContainEqual(['consent', 'update', { analytics_storage: 'granted' }])
  })

  it('envía page_view con la ruta SIN parámetros de búsqueda ni hash, y sin datos personales', () => {
    guardarConsentimiento({ analiticas: true })

    montar('/reservar-corte?correo=ana@example.com&telefono=3001234567#datos')

    expect(pageViews()).toEqual([
      ['event', 'page_view', { page_path: '/reservar-corte', page_location: `${window.location.origin}/reservar-corte` }],
    ])
    expect(JSON.stringify(llamadas())).not.toMatch(/@|3001234567|correo=|#datos/)
  })

  it('al aceptar con la página ya abierta envía su page_view; el único evento es page_view', () => {
    montar('/cortes')
    expect(pageViews()).toHaveLength(0)

    act(() => {
      guardarConsentimiento({ analiticas: true })
    })

    expect(pageViews()).toHaveLength(1)
    const eventos = llamadas().filter(([tipo]) => tipo === 'event')
    expect(eventos.every(([, nombre]) => nombre === 'page_view')).toBe(true)
  })

  it.each(['/acceso', '/panel', '/panel/citas', '/admin', '/admin/reportes'])(
    'no registra ni carga nada en la ruta privada %s',
    (ruta) => {
      guardarConsentimiento({ analiticas: true })
      montar(ruta)
      expect(pageViews()).toHaveLength(0)
      expect(scriptsGoogle()).toHaveLength(0)
    }
  )

  it('retirar el consentimiento deshabilita GA, deniega el consentimiento y borra _ga y _ga_*', () => {
    guardarConsentimiento({ analiticas: true })
    montar('/cortes')
    document.cookie = '_ga=GA1.1.111.222; path=/'
    document.cookie = '_ga_TEST123456=GS2.1.s1; path=/'
    document.cookie = 'otra=conservar; path=/'
    expect(document.cookie).toContain('_ga=')

    act(() => {
      guardarConsentimiento({ analiticas: false })
    })

    expect(window[`ga-disable-${ID}`]).toBe(true)
    expect(llamadas()).toContainEqual(['consent', 'update', expect.objectContaining({ analytics_storage: 'denied' })])
    expect(document.cookie).not.toMatch(/_ga/)
    expect(document.cookie).toContain('otra=conservar')
  })

  it('tras retirar el consentimiento no se vuelve a cargar el script ni se envían más páginas vistas', () => {
    guardarConsentimiento({ analiticas: true })
    const { unmount } = montar('/cortes')
    expect(scriptsGoogle()).toHaveLength(1)
    act(() => {
      guardarConsentimiento({ analiticas: false })
    })
    const antes = pageViews().length
    unmount()

    montar('/asesorias')

    expect(scriptsGoogle()).toHaveLength(1)
    expect(pageViews()).toHaveLength(antes)
  })

  it('volver a aceptar tras retirarlo reutiliza el script (no lo inyecta dos veces) y reactiva GA', () => {
    guardarConsentimiento({ analiticas: true })
    montar('/cortes')
    act(() => {
      guardarConsentimiento({ analiticas: false })
    })

    act(() => {
      guardarConsentimiento({ analiticas: true })
    })

    expect(scriptsGoogle()).toHaveLength(1)
    expect(window[`ga-disable-${ID}`]).toBe(false)
    expect(llamadas().filter(([t, n, v]) => t === 'consent' && n === 'update' && v.analytics_storage === 'granted')).toHaveLength(2)
  })
})
