import { useMemo } from 'react'
import { obtenerServiciosAsesoria } from '../services/api'
import { unirAsesorias } from '../data/asesorias'
import { useCarga } from './useCarga'

// Las asesorías de la API unidas con sus textos (data/asesorias.js) por `clave`. Mientras carga o si la API falla,
// `asesorias` trae los textos con `servicio: null` (no hay precios, duraciones ni ids inventados) y `estado` lo dice:
// 'cargando' | 'error' | 'listo'. Con 'listo', las que no están activas en la API llevan `servicio: null`.
export const useAsesoriasCatalogo = () => {
  const { datos, cargando, error, recargar } = useCarga(() => obtenerServiciosAsesoria(), 'asesorias')
  const asesorias = useMemo(() => unirAsesorias(datos), [datos])
  const estado = error ? 'error' : cargando && datos === null ? 'cargando' : 'listo'
  return { asesorias, estado, error, recargar }
}
