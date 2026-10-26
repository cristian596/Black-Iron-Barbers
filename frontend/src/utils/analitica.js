// Google Analytics 4 SOLO con consentimiento. Sin VITE_GA_MEASUREMENT_ID (formato G-XXXXXXXXXX) no hace nada. Antes del
// consentimiento no se inyecta el script ni se contacta a Google. No se envían datos personales: el único evento es
// page_view, con la ruta sin parámetros de búsqueda ni hash, y nunca de las áreas privadas.
const FORMATO_ID = /^G-[A-Z0-9]{4,20}$/
const RUTAS_PRIVADAS = ['/acceso', '/panel', '/admin']
const URL_GTAG = 'https://www.googletagmanager.com/gtag/js'

// El ID se lee al llamar (no al cargar el módulo) para poder probarlo.
export const idMedicion = () => {
  const id = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim().toUpperCase()
  return FORMATO_ID.test(id) ? id : ''
}

export const esRutaPrivada = (pathname) => {
  const ruta = String(pathname).toLowerCase().replace(/\/+$/, '') || '/'
  return RUTAS_PRIVADAS.some((privada) => ruta === privada || ruta.startsWith(`${privada}/`))
}

const inicializarGtag = () => {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    // gtag necesita el objeto `arguments` (no un arreglo) en dataLayer.
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
  }
}

const DENEGADO = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
}

// Cookies de GA4 (_ga y _ga_<id>), probando las variantes de dominio (sin dominio, host y dominios padre).
const nombresCookieGA = () =>
  document.cookie
    .split(';')
    .map((par) => par.split('=')[0].trim())
    .filter((nombre) => nombre === '_ga' || nombre.startsWith('_ga_'))

const dominiosCandidatos = () => {
  const partes = window.location.hostname.split('.')
  const dominios = ['']
  for (let i = 0; i < partes.length - 1; i += 1) dominios.push(`.${partes.slice(i).join('.')}`)
  if (partes.length > 1) dominios.push(partes.join('.'))
  return dominios
}

export const borrarCookiesGA = () => {
  try {
    const dominios = dominiosCandidatos()
    nombresCookieGA().forEach((nombre) => {
      dominios.forEach((dominio) => {
        const atributoDominio = dominio ? `; domain=${dominio}` : ''
        document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/${atributoDominio}`
      })
    })
  } catch {
    // sin acceso a cookies: nada que borrar
  }
}

let configurado = null // ID con el que ya se inicializó gtag
let denegado = false // el consentimiento se retiró y aún no se volvió a conceder

// Con consentimiento: carga el script de gtag una sola vez y lo configura sin página vista automática.
export const habilitarAnalitica = () => {
  const id = idMedicion()
  if (!id || typeof document === 'undefined') return false
  if (configurado === id && !denegado) return true
  window[`ga-disable-${id}`] = false
  inicializarGtag()

  if (configurado !== id) {
    configurado = id
    window.gtag('consent', 'default', DENEGADO)
    window.gtag('js', new Date())
    window.gtag('config', id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    const script = document.createElement('script')
    script.async = true
    script.src = `${URL_GTAG}?id=${encodeURIComponent(id)}`
    document.head.appendChild(script)
  }
  window.gtag('consent', 'update', { analytics_storage: 'granted' })
  denegado = false
  return true
}

// Sin consentimiento (o al retirarlo): GA queda deshabilitado, el consentimiento denegado y sus cookies borradas. No
// carga nada. Si el script ya estaba cargado, el cambio se completa del todo al recargar la página.
export const deshabilitarAnalitica = () => {
  const id = idMedicion()
  if (!id || typeof window === 'undefined') return
  window[`ga-disable-${id}`] = true
  denegado = true
  if (configurado === id && typeof window.gtag === 'function') window.gtag('consent', 'update', DENEGADO)
  borrarCookiesGA()
}

// Única llamada de evento: page_view con la ruta limpia. Ignora las áreas privadas.
export const registrarPageView = (pathname) => {
  const id = idMedicion()
  if (!id || configurado !== id || typeof window.gtag !== 'function') return false
  if (esRutaPrivada(pathname)) return false
  window.gtag('event', 'page_view', {
    page_path: pathname,
    page_location: `${window.location.origin}${pathname}`,
  })
  return true
}

// Solo para pruebas.
export const reiniciarAnalitica = () => {
  configurado = null
  denegado = false
}
