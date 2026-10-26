import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useConsentimiento } from '../../hooks/useConsentimiento'
import { deshabilitarAnalitica, esRutaPrivada, habilitarAnalitica, registrarPageView } from '../../utils/analitica'

// Envía un page_view a Google Analytics en cada cambio de ruta (solo con consentimiento y con VITE_GA_MEASUREMENT_ID).
// Usa solo el pathname: sin parámetros de búsqueda ni hash. No actúa en las áreas privadas (/acceso, /panel, /admin).
const AnaliticaRutas = () => {
  const { pathname } = useLocation()
  const { analiticas } = useConsentimiento()

  // Sin consentimiento (o al retirarlo): GA deshabilitado y sus cookies fuera.
  useEffect(() => {
    if (!analiticas) deshabilitarAnalitica()
  }, [analiticas])

  useEffect(() => {
    if (!analiticas || esRutaPrivada(pathname)) return
    if (habilitarAnalitica()) registrarPageView(pathname)
  }, [analiticas, pathname])

  return null
}

export default AnaliticaRutas
