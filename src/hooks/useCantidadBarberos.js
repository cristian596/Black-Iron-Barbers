import { useEffect, useState } from 'react'
import { obtenerBarberos } from '../services/api'
import { soloBarberia } from '../utils/areas'

// Caché en memoria: el hero y las estadísticas comparten una sola petición.
let peticion = null

const cargarCantidad = () => {
  if (!peticion) {
    // Solo cuentan los barberos de barbería: la asesora de imagen está en el equipo pero no es un barbero.
    peticion = obtenerBarberos().then((barberos) =>
      Array.isArray(barberos) ? soloBarberia(barberos).length : 0
    )
    // Un fallo no se guarda: la siguiente consulta vuelve a intentarlo
    peticion.catch(() => {
      peticion = null
    })
  }
  return peticion
}

export const reiniciarCacheBarberos = () => {
  peticion = null
}

// Cantidad de barberos de la API: null mientras carga y 0 si falla o no hay
// (nunca se inventa la cifra).
const useCantidadBarberos = () => {
  const [cantidad, setCantidad] = useState(null)

  useEffect(() => {
    let activo = true
    cargarCantidad()
      .then((total) => {
        if (activo) setCantidad(total)
      })
      .catch(() => {
        if (activo) setCantidad(0)
      })
    return () => {
      activo = false
    }
  }, [])

  return cantidad
}

export default useCantidadBarberos
