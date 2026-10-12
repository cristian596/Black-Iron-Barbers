import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ESPERA_MAX_MS = 5000

const leerId = (hash) => {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''))
  } catch {
    return ''
  }
}

const movimientoReducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Lleva la página a la sección cuyo id está en el hash de la URL y mueve el foco a su encabezado.
// - Solo actúa con ids de `idsValidos` (un hash cualquiera no hace nada).
// - Depende de `hash` y de `key`: funciona al llegar desde otra ruta, con la página ya abierta y al repetir el mismo hash.
// - Si la sección aún no existe (página con React.lazy), espera a que aparezca (máx. 5 s).
// - Scroll suave solo sin prefers-reduced-motion. La compensación de la barra fija la pone la sección con `scroll-mt-*`.
export const useScrollAHash = (idsValidos) => {
  const { hash, key } = useLocation()
  const lista = idsValidos.join('|')

  useEffect(() => {
    const id = leerId(hash)
    if (!id || !lista.split('|').includes(id)) return undefined

    const ir = () => {
      const seccion = document.getElementById(id)
      if (!seccion) return false
      seccion.scrollIntoView?.({ block: 'start', behavior: movimientoReducido() ? 'auto' : 'smooth' })
      const encabezado = seccion.querySelector('h1, h2, h3')
      if (encabezado) {
        if (!encabezado.hasAttribute('tabindex')) encabezado.setAttribute('tabindex', '-1')
        encabezado.focus({ preventScroll: true })
      }
      return true
    }

    if (ir()) return undefined

    const observador = new MutationObserver(() => {
      if (ir()) observador.disconnect()
    })
    observador.observe(document.body, { childList: true, subtree: true })
    const limite = setTimeout(() => observador.disconnect(), ESPERA_MAX_MS)
    return () => {
      observador.disconnect()
      clearTimeout(limite)
    }
  }, [hash, key, lista])
}
