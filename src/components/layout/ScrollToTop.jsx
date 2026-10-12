import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Al cambiar de ruta (PUSH/REPLACE) lleva la página arriba. No actúa con hash (lo resuelven
// los enlaces con ancla y useScrollAHash), con atrás/adelante (POP) ni si solo cambia la query.
// No hay scroll-behavior suave global, así que scrollTo(0, 0) es instantáneo.
const ScrollToTop = () => {
  const { pathname, hash } = useLocation()
  const tipo = useNavigationType()
  const anterior = useRef(pathname)

  useEffect(() => {
    const cambioDeRuta = anterior.current !== pathname
    anterior.current = pathname
    if (!cambioDeRuta || hash || tipo === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, hash, tipo])

  return null
}

export default ScrollToTop
