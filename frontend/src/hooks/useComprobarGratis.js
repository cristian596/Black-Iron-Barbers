import { useEffect, useState } from 'react'
import { comprobarAsesoriaGratis } from '../services/api'
import { esTelefonoValido } from '../utils/telefono'

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const ESPERA_COMPROBAR_MS = 600

// Comprobación temprana de la asesoría gratis: cuando `activo` (la reserva la incluye) y el correo y el teléfono son
// válidos, pregunta al servidor si esa persona aún puede usarla. Con espera (debounce) para no preguntar en cada tecla
// y cancelando la petición anterior. Devuelve true/false, o null si no se sabe (datos incompletos, esperando, o si la
// comprobación falla o devuelve 429): NUNCA bloquea al cliente por un error; la verdad la decide POST /api/citas.
export const useComprobarGratis = ({ activo, correo, telefono }) => {
  const valido = Boolean(activo) && REGEX_CORREO.test(correo) && esTelefonoValido(telefono)
  const clave = valido ? `${correo}\n${telefono}` : ''
  const [resultado, setResultado] = useState({ clave: '', disponible: null })

  useEffect(() => {
    if (!clave) return undefined
    const control = new AbortController()
    const espera = setTimeout(async () => {
      try {
        const respuesta = await comprobarAsesoriaGratis(correo, telefono, control.signal)
        if (typeof respuesta?.disponible === 'boolean') setResultado({ clave, disponible: respuesta.disponible })
      } catch {
        // Falló o hay límite de intentos (429): se sigue sin bloquear. El POST decide.
      }
    }, ESPERA_COMPROBAR_MS)
    return () => {
      clearTimeout(espera)
      control.abort()
    }
  }, [clave, correo, telefono])

  // Un resultado solo vale para los datos con los que se pidió: si el cliente los cambió, vuelve a ser "no se sabe".
  return valido && resultado.clave === clave ? resultado.disponible : null
}
