import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { obtenerServicios } from '../services/api'
import { AREA_BARBERIA } from '../utils/areas'
import { MAX_SERVICIOS, evaluarAgregado, guardarSeleccion, leerSeleccionGuardada } from '../utils/carrito'

const CarritoContext = createContext(null)

const mensajeQuitados = (nombres, cantidad) => {
  if (nombres.length === 1) return `"${nombres[0]}" ya no está disponible y lo quitamos de tu selección.`
  if (nombres.length > 1) return `Quitamos de tu selección ${nombres.map((n) => `"${n}"`).join(', ')}: ya no están disponibles.`
  return cantidad === 1
    ? 'Un servicio de tu selección ya no está disponible y lo quitamos.'
    : `${cantidad} servicios de tu selección ya no están disponibles y los quitamos.`
}

// Selección de servicios ("Tu selección"): lista ordenada de ids (máx. 3) que vive en el layout público para
// sobrevivir a la navegación entre la carta y la reserva. Se guarda en sessionStorage (con try/catch: sin él funciona
// igual, solo que no sobrevive a recargar). Al cargar la carta y al abrir el carrito se valida contra
// GET /api/servicios y se quitan los servicios inactivos o inexistentes con un aviso.
export const ProveedorCarrito = ({ children }) => {
  const [ids, setIds] = useState(leerSeleccionGuardada)
  // Datos (nombre, duración, precio, categoría) de los servicios conocidos; lo guardado en sessionStorage es solo el id.
  const [catalogo, setCatalogo] = useState(() => new Map())
  const [aviso, setAviso] = useState('')
  // Espejo síncrono: dos clics seguidos no deben decidir con un estado viejo.
  const idsRef = useRef(ids)
  const catalogoRef = useRef(catalogo)

  const aplicarIds = useCallback((nuevos) => {
    idsRef.current = nuevos
    setIds(nuevos)
    guardarSeleccion(nuevos)
  }, [])

  const registrar = useCallback((servicios) => {
    const mapa = new Map(catalogoRef.current)
    servicios.forEach((servicio) => mapa.set(servicio.id, servicio))
    catalogoRef.current = mapa
    setCatalogo(mapa)
  }, [])

  // Intenta añadir; devuelve { permitido, motivo, mensaje } (ver evaluarAgregado).
  const agregar = useCallback(
    (servicio) => {
      const actuales = idsRef.current
      if (actuales.includes(servicio.id)) return { permitido: true, motivo: null, mensaje: '' }
      const conocidos = actuales.map((id) => catalogoRef.current.get(id)).filter(Boolean)
      const evaluacion = evaluarAgregado(conocidos, servicio, actuales.length)
      if (!evaluacion.permitido) return evaluacion
      registrar([servicio])
      setAviso('')
      aplicarIds([...actuales, servicio.id])
      return evaluacion
    },
    [aplicarIds, registrar]
  )

  const quitar = useCallback(
    (id) => {
      setAviso('')
      aplicarIds(idsRef.current.filter((actual) => actual !== id))
    },
    [aplicarIds]
  )

  const vaciar = useCallback(() => {
    setAviso('')
    aplicarIds([])
  }, [aplicarIds])

  const alternar = useCallback(
    (servicio) => {
      if (idsRef.current.includes(servicio.id)) {
        quitar(servicio.id)
        return { permitido: true, motivo: null, mensaje: '' }
      }
      return agregar(servicio)
    },
    [agregar, quitar]
  )

  // Recibe la lista de servicios ACTIVOS (GET /api/servicios): guarda sus datos y quita lo que ya no está.
  const sincronizar = useCallback(
    (activos) => {
      const previos = catalogoRef.current
      const porId = new Map(activos.map((servicio) => [servicio.id, servicio]))
      catalogoRef.current = porId
      setCatalogo(porId)

      const actuales = idsRef.current
      const vigentes = actuales.filter((id) => porId.has(id))
      if (vigentes.length !== actuales.length) {
        const quitados = actuales.filter((id) => !porId.has(id))
        const nombres = quitados.map((id) => previos.get(id)?.nombre).filter(Boolean)
        aplicarIds(vigentes)
        setAviso(mensajeQuitados(nombres.length === quitados.length ? nombres : [], quitados.length))
      }
    },
    [aplicarIds]
  )

  // Al abrir el carrito: se vuelve a pedir el catálogo. Si falla, se conserva lo que hay.
  const revalidar = useCallback(async () => {
    try {
      sincronizar(await obtenerServicios({ area: AREA_BARBERIA })) // el carrito solo guarda servicios de barbería
    } catch {
      // sin conexión: la validación definitiva la hace el servidor al reservar
    }
  }, [sincronizar])

  const descartarAviso = useCallback(() => setAviso(''), [])

  const seleccion = useMemo(() => ids.map((id) => catalogo.get(id)).filter(Boolean), [ids, catalogo])

  const valor = useMemo(
    () => ({ ids, seleccion, aviso, agregar, quitar, vaciar, alternar, sincronizar, revalidar, descartarAviso, maximo: MAX_SERVICIOS }),
    [ids, seleccion, aviso, agregar, quitar, vaciar, alternar, sincronizar, revalidar, descartarAviso]
  )

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCarrito = () => {
  const contexto = useContext(CarritoContext)
  if (!contexto) throw new Error('useCarrito debe usarse dentro de <ProveedorCarrito>')
  return contexto
}
