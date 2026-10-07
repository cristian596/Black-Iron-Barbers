import { describe, it, expect } from 'vitest'

// Guarda estática: la parte pública de las asesorías no importa nada del dashboard (admin/panel),
// ni la sesión, ni el perfil. Mismo enfoque que las guardas de perfil: se leen los archivos como texto.
const archivos = {
  ...import.meta.glob('../components/sections/asesorias/**/*.jsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../components/layout/{NavBar,BotonClienteNuevo,ModalAsesorias,FixedWhatsapp}.jsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../pages/{Asesorias,Landingpage}.jsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../hooks/{useScrollAHash,useTitulo}.js', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../data/{asesorias,negocio}.js', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../routes/RedirigirAsesoria.jsx', { query: '?raw', import: 'default', eager: true }),
}

const PROHIBIDO =
  /from\s+['"][^'"]*(components\/admin|components\/panel|pages\/admin|pages\/panel|pages\/Configuracion|context\/(Auth|Perfil|CambiosPerfil|ResumenBarbero)|ProtectedRoute|RoleRoute)[^'"]*['"]/

describe('Asesorías públicas: sin dependencias del dashboard', () => {
  it('encuentra los archivos a revisar', () => {
    expect(Object.keys(archivos).length).toBeGreaterThanOrEqual(12)
  })

  it.each(Object.entries(archivos))('%s no importa admin, panel, sesión ni perfil', (ruta, texto) => {
    expect(PROHIBIDO.test(texto), ruta).toBe(false)
  })

  it('ningún archivo trae un número de teléfono escrito (el número solo sale de VITE_WHATSAPP_NUMERO)', () => {
    for (const [ruta, texto] of Object.entries(archivos)) {
      expect(/wa\.me\/\d{6,}/.test(texto), ruta).toBe(false)
    }
  })
})
