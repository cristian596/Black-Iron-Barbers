import { useEffect, useState } from 'react'
import { obtenerBarberos } from '../services/api'

// Barberos activos (los que se muestran en la web y reciben citas), para selectores del panel.
export const useBarberosActivos = () => {
  const [barberosActivos, setBarberosActivos] = useState([])
  const [errorBarberos, setErrorBarberos] = useState('')

  useEffect(() => {
    const cargarBarberos = async () => {
      try {
        setBarberosActivos(await obtenerBarberos())
      } catch (err) {
        setErrorBarberos(err.message)
      }
    }
    cargarBarberos()
  }, [])

  return { barberosActivos, errorBarberos }
}
