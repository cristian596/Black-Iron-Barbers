import { describe, it, expect } from 'vitest'

// Guarda estática: el carrito y la carta de /cortes son SOLO de barbería. Las asesorías se piden con
// obtenerServiciosAsesoria (nunca con obtenerServicios sin area) y solo desde los archivos de la lista blanca.
const archivos = import.meta.glob(['../**/*.{js,jsx}', '!../tests/**'], { query: '?raw', import: 'default', eager: true })

const PERMITIDOS_ASESORIA = [
  '../hooks/useAsesoriasCatalogo.js', // /asesorias y el modal "Soy cliente nuevo"
  '../pages/ReservaCorte.jsx', // el bloque "Añadir una asesoría" del flujo de reserva
  '../services/api.js', // la definición
]

describe('Asesorías fuera del carrito y de la carta de cortes', () => {
  it('encuentra los archivos a revisar', () => {
    expect(Object.keys(archivos).length).toBeGreaterThan(100)
  })

  it('solo la lista blanca usa obtenerServiciosAsesoria', () => {
    const usuarios = Object.entries(archivos)
      .filter(([, texto]) => /\bobtenerServiciosAsesoria\b/.test(texto))
      .map(([ruta]) => ruta)
      .sort()
    expect(usuarios).toEqual([...PERMITIDOS_ASESORIA].sort())
  })

  it.each([
    '../context/CarritoContext.jsx',
    '../components/sections/CatalogoServicios.jsx',
    '../pages/Cortes.jsx',
    '../components/carrito/CarritoServicios.jsx',
    '../components/carrito/ContenidoCarrito.jsx',
  ])('%s pide servicios solo con area barbería y no conoce las asesorías', (ruta) => {
    const texto = archivos[ruta]
    expect(texto, ruta).toBeTypeOf('string')
    expect(/obtenerServiciosAsesoria|reservaAsesoria|useAsesoriasCatalogo|AREA_ASESORIA/.test(texto)).toBe(false)
    for (const [, argumento] of texto.matchAll(/\bobtenerServicios\(([^)]*)\)/g)) {
      expect(argumento).toMatch(/\barea\s*:\s*AREA_BARBERIA\b/)
    }
  })
})
