import { describe, it, expect, vi, afterEach } from 'vitest'
import { descargarReporteDiarioCsv, setUnauthorizedHandler } from '../services/api'
import { guardarArchivo } from '../utils/descarga'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setUnauthorizedHandler(null)
})

describe('descargarReporteDiarioCsv', () => {
  it('pide el CSV con el token en Authorization (un enlace directo no lo llevaría) y devuelve el blob con su nombre', async () => {
    const blob = new Blob(['\uFEFFa;b'], { type: 'text/csv' })
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob })
    vi.stubGlobal('fetch', fetchFalso)

    const resultado = await descargarReporteDiarioCsv('tok', '2026-10-04')

    const [url, opciones] = fetchFalso.mock.calls[0]
    expect(url).toMatch(/\/admin\/reportes\/diario\.csv\?fecha=2026-10-04$/)
    expect(opciones.headers).toEqual({ Authorization: 'Bearer tok' })
    expect(resultado).toEqual({ blob, nombre: 'reporte-diario-2026-10-04.csv' })
  })

  it('un error del servidor lanza un Error con el texto, el código y el estado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ error: 'No hay reporte de un día que todavía no llega', codigo: 'FECHA_FUTURA' }),
    }))
    await expect(descargarReporteDiarioCsv('tok', '2099-01-01')).rejects.toMatchObject({
      message: 'No hay reporte de un día que todavía no llega', codigo: 'FECHA_FUTURA', status: 400,
    })
  })

  it('un 401 cierra la sesión (como el resto de llamadas) y sin cuerpo JSON usa un mensaje genérico', async () => {
    const alNoAutorizado = vi.fn()
    setUnauthorizedHandler(alNoAutorizado)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => { throw new Error('sin cuerpo') } }))

    await expect(descargarReporteDiarioCsv('tok', '2026-10-04')).rejects.toThrow('No se pudo descargar el reporte')
    expect(alNoAutorizado).toHaveBeenCalledTimes(1)
  })

  it('sin conexión lanza el mensaje de siempre', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fallo de red')))
    await expect(descargarReporteDiarioCsv('tok', '2026-10-04')).rejects.toThrow('No se pudo conectar con el servidor')
  })
})

describe('guardarArchivo', () => {
  it('crea un enlace temporal con el nombre indicado, lo pulsa y libera la URL', () => {
    URL.createObjectURL = vi.fn(() => 'blob:falso')
    URL.revokeObjectURL = vi.fn()
    const pulsar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function pulsado() {
      expect(this.download).toBe('reporte-diario-2026-10-04.csv')
      expect(this.href).toBe('blob:falso')
    })

    guardarArchivo(new Blob(['x']), 'reporte-diario-2026-10-04.csv')

    expect(pulsar).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:falso')
    expect(document.querySelector('a[download]')).toBeNull() // el enlace no queda en la página
  })
})
