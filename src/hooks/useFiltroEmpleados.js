import { useMemo, useState } from 'react'
import { filtrarEmpleados, ordenarEmpleados } from '../utils/empleados'

const ESTADO_INICIAL = 'activos'

// Filtros de /admin/empleados sobre la lista completa que ya cargó la pantalla. Son pocos empleados: sin
// paginación, ordenados alfabéticamente en español (el back-end no decide el orden que se ve).
export const useFiltroEmpleados = (empleados) => {
  const [estado, setEstado] = useState(ESTADO_INICIAL)
  const [busqueda, setBusqueda] = useState('')

  const ordenados = useMemo(() => ordenarEmpleados(empleados), [empleados])
  const visibles = useMemo(() => filtrarEmpleados(ordenados, { estado, busqueda }), [ordenados, estado, busqueda])
  const conteos = useMemo(() => {
    const activos = empleados.filter((e) => e.activo).length
    return { activos, inactivos: empleados.length - activos, todos: empleados.length }
  }, [empleados])

  const hayFiltros = busqueda.trim() !== '' || estado !== ESTADO_INICIAL
  const limpiar = () => {
    setBusqueda('')
    setEstado(ESTADO_INICIAL)
  }

  return { estado, setEstado, busqueda, setBusqueda, visibles, conteos, hayFiltros, limpiar }
}
